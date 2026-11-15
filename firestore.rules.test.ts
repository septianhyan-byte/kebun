/**
 * Security Rules Specification Verification Suite (Dirty Dozen Test Matrix)
 * Run with Firebase Emulator Suite (@firebase/rules-unit-testing) when testing locally.
 */
import assert from 'node:assert/strict';

export interface DirtyDozenCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  authUid: string | null;
  emailVerified: boolean;
  email?: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Cross-user read/write blocked',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'get',
    authUid: 'user-b',
    emailVerified: true,
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email blocked on write',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: false,
    payload: { id: 'season-1', ownerUid: 'user-a', title: 'Test' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'OwnerUID spoofing blocked',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'season-1', ownerUid: 'user-b', title: 'Spoofed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow ghost field blocked via hasOnly',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'season-1', ownerUid: 'user-a', title: 'OK', isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID poisoning blocked by regex',
    collectionPath: 'users/user-a/seasons/bad$id',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'bad$id', ownerUid: 'user-a', title: 'Bad ID' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Oversized title string blocked',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'season-1', ownerUid: 'user-a', title: 'A'.repeat(200) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client-forged createdAt timestamp blocked',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'season-1', ownerUid: 'user-a', title: 'Batch 1', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Immutable ownerUid change on update blocked',
    collectionPath: 'users/user-a/seasons/season-1',
    operation: 'update',
    authUid: 'user-a',
    emailVerified: true,
    payload: { ownerUid: 'user-b' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Orphaned subcollection write without parent blocked',
    collectionPath: 'users/user-a/seasons/missing-season/greenhouses/gh-1/waterLogs/log-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'log-1', ownerUid: 'user-a', ppm: 700 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Invalid growth phase enum blocked',
    collectionPath: 'users/user-a/seasons/season-1/greenhouses/gh-1',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'gh-1', ownerUid: 'user-a', seasonId: 'season-1', phase: 'hacked' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Invalid PlantBlock array size or non-map element blocked',
    collectionPath: 'users/user-a/seasons/season-1/greenhouses/gh-1/plantBlocks/block-0',
    operation: 'create',
    authUid: 'user-a',
    emailVerified: true,
    payload: { id: 'block-0', ownerUid: 'user-a', plants: ['invalid'] },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Supervision activity audit log update blocked',
    collectionPath: 'users/user-a/seasons/season-1/activities/act-1',
    operation: 'update',
    authUid: 'user-a',
    emailVerified: true,
    payload: { summary: 'Altered history' },
    expectedResult: 'PERMISSION_DENIED',
  },
];

assert.equal(DIRTY_DOZEN_CASES.length, 12);

export const EMAIL_ALLOWLIST_CASES: DirtyDozenCase[] = [
  {
    id: 13,
    name: 'Verified third-party Google email blocked by email allowlist',
    collectionPath: 'users/user-other/seasons/season-1',
    operation: 'create',
    authUid: 'user-other',
    emailVerified: true,
    email: 'stranger@gmail.com',
    payload: { id: 'season-1', ownerUid: 'user-other', title: 'Unauthorized' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Allowed email with unverified email_verified=false blocked (spoof guard)',
    collectionPath: 'users/user-owner/seasons/season-1',
    operation: 'create',
    authUid: 'user-owner',
    emailVerified: false,
    email: 'septianhyan@gmail.com',
    payload: { id: 'season-1', ownerUid: 'user-owner', title: 'Spoofed' },
    expectedResult: 'PERMISSION_DENIED',
  },
];

assert.equal(EMAIL_ALLOWLIST_CASES.length, 2);
