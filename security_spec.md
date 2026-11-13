# Security Specification — MelonFlow NFT Firestore Rules

## 1. Data Invariants

1. **Identity Isolation & Shared Google Account**:
   - Every user workspace is anchored strictly under `/users/{userId}` where `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.uid == userId`.
   - Any device signed in with the **same Google account** has the same `request.auth.uid`, enabling live multi-device sharing and supervision while strictly blocking all other Google accounts from reading or writing PII or farm records.
2. **PII Isolation**:
   - User email and display name live solely inside `/users/{userId}/profile/info` and `activities.actorEmail` under `/users/{userId}`, readable and writable only by `request.auth.uid == userId`. Zero blanket `isSignedIn()` reads exist.
3. **Immutable Ownership & Timestamps**:
   - `ownerUid` on every document MUST equal `request.auth.uid` on `create` and remain immutable (`incoming().ownerUid == existing().ownerUid`) on `update`.
   - `createdAt` MUST equal `request.time` on `create` and remain immutable on `update`.
   - `updatedAt` MUST equal `request.time` on both `create` and `update`.
4. **Master Gate Relational Integrity**:
   - Subcollections (`greenhouses`, `waterLogs`, `treatments`, `plantBlocks`, `activities`) verify parent existence via `exists(...) || existsAfter(...)` on `create` and parent `ownerUid` integrity on reads/writes.
5. **Path & Size Poisoning Guards**:
   - All path IDs (`userId`, `seasonId`, `ghId`, `logId`, `treatmentId`, `blockId`, `activityId`, `docId`) MUST match `^[a-zA-Z0-9_\\-]+$` and `.size() <= 128` on single-doc operations (`get`, `create`, `update`, `delete`).
   - Every string field enforces strict `.size()` upper bounds matching `firebase-blueprint.json`, and arrays (`greenhouseOrder` <= 50, `plants` <= 100) enforce bounded lengths + index type checks.
6. **Zero Shadow Fields / Action-Based Updates**:
   - Every `create` checks `keys().hasAll(...) && keys().hasOnly(...)`.
   - Every `update` wraps `isValid[Entity](incoming())` first and branches on explicit `affectedKeys().hasOnly(...)` allowlists.
7. **Supervision Log Append-Only Integrity**:
   - `/activities/{activityId}` is append-only (audit trail): `update` is denied (`allow update: if false;`), and `delete` requires `isOwner(userId)` only for season cleanup.

## 2. The "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)

1. **Cross-User Read/Write**: User B (`uid: "user-b"`) tries to read or write `/users/user-a/seasons/season-1`.
2. **Unverified Email Spoofing**: User A with `email_verified: false` tries to create `/users/user-a/seasons/season-1`.
3. **OwnerUID Spoofing**: User A creates `/users/user-a/seasons/season-1` with `{ ownerUid: "user-b" }`.
4. **Shadow Ghost Field Injection**: User A creates `SeasonMeta` including an unallowed key `{ isAdmin: true }`.
5. **ID Poisoning**: User A attempts to create `/users/user-a/seasons/bad$id..with..slash` or a 200-char ID.
6. **Oversized String DoW Attack**: User A creates `SeasonMeta` with `title` of 500 characters (`maxLength: 160`).
7. **Timestamp Forgery**: User A sets `createdAt: "2020-01-01T00:00:00Z"` instead of server timestamp `request.time`.
8. **Immutable Field Mutation**: User A updates `SeasonMeta` changing `ownerUid` or `createdAt`.
9. **Orphaned Subcollection Write**: User A creates a `waterLog` under a non-existent `seasonId` or `ghId`.
10. **Invalid Enum Value**: User A creates `GreenhouseMeta` with `phase: "invalid_phase"` or `TreatmentItem` with `status: "hacked"`.
11. **Unbounded Array / Type Poisoning in PlantBlock**: User A writes `PlantBlock` with `plants: []`, `plants.size() > 100`, or `plants: ["not-a-map"]`.
12. **Audit Log Tampering**: User A attempts to `update` an existing `/activities/{activityId}` record to alter supervision history.
