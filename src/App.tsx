import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from 'firebase/auth';
import { AlertTriangle, BellRing, ChevronLeft, ChevronRight, Cloud, CloudOff, Edit3, Info, Plus } from 'lucide-react';
import { BOTANICAL_THEMES, FONT_OPTIONS, GROWTH_PHASE_SPECS } from './constants/themes';
import { auth, googleProvider, parseFirestoreErrorMessage } from './firebase';
import { useOnlineStatus } from './hooks/usePWAInstall';
import {
  addGreenhouseToCloud,
  CloudSeasonMeta,
  deleteGreenhouseFromCloud,
  deleteSeasonFromCloud,
  fetchSeasonFromCloud,
  getSavedDeviceLabel,
  saveDeviceLabel,
  savePaymentProfileToCloud,
  subscribePaymentProfileRealtime,
  subscribeSeasonRealtime,
  subscribeUserSeasons,
  syncGreenhouseDeltaToCloud,
  updateActiveGhInCloud,
  uploadSeasonToCloud,
  upsertUserProfile,
} from './services/cloudSync';
import {
  AppSettings,
  DashboardTab,
  GreenhouseData,
  GrowthPhase,
  PrintSelection,
  SeasonDocument,
  SelfSalePaymentProfile,
  SelfSaleReceipt,
  SupervisionActivity,
} from './types';
import {
  createGreenhouse,
  DEFAULT_PAYMENT_PROFILE,
  generatePlants,
  loadDocuments,
  loadOfflineModePref,
  loadPaymentProfile,
  loadPendingPaymentSync,
  loadPendingSyncQueue,
  loadSettings,
  normalizeSeasonDocument,
  saveDocuments,
  saveOfflineModePref,
  savePaymentProfile,
  savePendingPaymentSync,
  savePendingSyncQueue,
  saveSettings,
} from './utils/storage';
import {
  evaluateGreenhouseAlerts,
  playNotificationChime,
  sendBrowserNotification,
} from './utils/notifications';
import { TopToolbar } from './components/TopToolbar';
import { DashboardWaterControl } from './components/DashboardWaterControl';
import { DashboardTreatments } from './components/DashboardTreatments';
import { DashboardPlantsMatrix } from './components/DashboardPlantsMatrix';
import { DashboardAccounting } from './components/DashboardAccounting';
import { SettingsModal } from './components/SettingsModal';
import { GreenhouseModal } from './components/GreenhouseModal';
import { MobileApkModal } from './components/MobileApkModal';
import { NewDocumentModal } from './components/NewDocumentModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PrintModal } from './components/PrintModal';
import { PrintableReport } from './components/PrintableReport';
import { PrintableReceipt } from './components/PrintableReceipt';
import { AccountSyncModal } from './components/AccountSyncModal';
import { DEFAULT_PRINT_SELECTION } from './utils/printer';

function hexToSoftRgba(hex: string, alpha = 0.12): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(21, 128, 61, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const DASHBOARD_ORDER: DashboardTab[] = ['water', 'treatment', 'plants', 'accounting'];

function formatGoogleAuthError(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return `Domain aplikasi (${host}) belum diizinkan di Firebase Authentication → Authorized Domains. Gunakan URL aplikasi resmi yang sudah terdaftar atau tambahkan domain ini di Firebase Console.`;
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup login Google diblokir oleh browser. Izinkan popup atau buka langsung di Google Chrome.';
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Jendela login Google ditutup sebelum selesai. Silakan coba masuk lagi.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Koneksi internet terputus saat menghubungi layanan login Google.';
  }
  return err instanceof Error ? err.message : 'Login Google dibatalkan atau gagal.';
}

function hasHorizontalScrollAncestor(
  target: EventTarget | null,
  boundary: HTMLElement | null
): boolean {
  let node = target instanceof HTMLElement ? target : null;
  while (node && node !== boundary) {
    const tag = node.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'SVG') {
      return true;
    }
    const style = window.getComputedStyle(node);
    const ox = style.overflowX;
    if ((ox === 'auto' || ox === 'scroll') && node.scrollWidth > node.clientWidth + 6) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [docStore, setDocStore] = useState<{ documents: SeasonDocument[]; activeDocId: string }>(() =>
    loadDocuments()
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>('water');
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Modals state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [ghModalState, setGhModalState] = useState<{ open: boolean; mode: 'add' | 'edit' }>({
    open: false,
    mode: 'edit',
  });
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [mobileApkOpen, setMobileApkOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [printSelection, setPrintSelection] = useState<PrintSelection>(DEFAULT_PRINT_SELECTION);
  const [activePrintReceipt, setActivePrintReceipt] = useState<SelfSaleReceipt | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>([]);

  // Payment profile (Rekening & QRIS Galeri) + Cloud sync state
  const [paymentProfile, setPaymentProfile] = useState<SelfSalePaymentProfile>(() =>
    loadPaymentProfile()
  );
  const [pendingPaymentSync, setPendingPaymentSync] = useState<boolean>(() =>
    loadPendingPaymentSync()
  );
  const paymentProfileRef = useRef(paymentProfile);
  paymentProfileRef.current = paymentProfile;
  const pendingPaymentSyncRef = useRef(pendingPaymentSync);
  pendingPaymentSyncRef.current = pendingPaymentSync;
  const paymentSyncTimerRef = useRef<number | null>(null);
  const fetchedOtherSeasonUpdatedAtRef = useRef<Map<string, string>>(new Map());

  // Firebase Auth, Offline Mode & Real-Time Cloud Sync state
  const isBrowserOnline = useOnlineStatus();
  const [manualOfflineMode, setManualOfflineMode] = useState<boolean>(() => loadOfflineModePref());
  const isEffectivelyOffline = !isBrowserOnline || manualOfflineMode;
  const [pendingQueue, setPendingQueue] = useState<{ upsertIds: string[]; deleteIds: string[] }>(
    () => loadPendingSyncQueue()
  );
  const [cloudUser, setCloudUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [deviceLabel, setDeviceLabel] = useState<string>(() => getSavedDeviceLabel());
  const [cloudMetas, setCloudMetas] = useState<CloudSeasonMeta[]>([]);
  const [activities, setActivities] = useState<SupervisionActivity[]>([]);
  const autoUploadedUsersRef = useRef<Set<string>>(new Set());
  const docStoreRef = useRef(docStore);
  docStoreRef.current = docStore;
  const pendingQueueRef = useRef(pendingQueue);
  pendingQueueRef.current = pendingQueue;
  const activeCloudMetaRef = useRef<CloudSeasonMeta | null>(null);
  const cloudMetasRef = useRef<CloudSeasonMeta[]>(cloudMetas);
  cloudMetasRef.current = cloudMetas;
  const skippedRemoteSeasonIdsRef = useRef<Set<string>>(new Set());
  const flushingRef = useRef(false);
  const pendingDeltaMapRef = useRef<
    Map<
      string,
      {
        seasonId: string;
        ghId: string;
        prevGh: GreenhouseData;
        nextGh: GreenhouseData;
        user: User;
        deviceLabel: string;
        timer: number;
      }
    >
  >(new Map());
  const inFlightDeltaSeasonRef = useRef<Map<string, number>>(new Map());
  const seasonEchoHoldUntilRef = useRef<Map<string, number>>(new Map());

  const pendingSyncCount =
    pendingQueue.upsertIds.length +
    pendingQueue.deleteIds.length +
    (pendingPaymentSync ? 1 : 0);

  const activeDoc = useMemo(() => {
    return (
      docStore.documents.find((d) => d.id === docStore.activeDocId) ||
      docStore.documents[0]
    );
  }, [docStore]);

  const activeGh = useMemo(() => {
    return (
      activeDoc.greenhouses.find((g) => g.id === activeDoc.activeGhId) ||
      activeDoc.greenhouses[0]
    );
  }, [activeDoc]);

  // Apply botanical theme, font, accent color & dark class to documentElement
  useEffect(() => {
    saveSettings(settings);
    const theme =
      BOTANICAL_THEMES.find((t) => t.id === settings.themeId) || BOTANICAL_THEMES[0];
    const font =
      FONT_OPTIONS.find((f) => f.id === settings.fontId) || FONT_OPTIONS[0];

    const root = document.documentElement;
    if (theme.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    root.style.setProperty('--app-font', font.family);
    root.style.setProperty('--app-canvas', theme.canvas);
    root.style.setProperty('--app-surface', theme.surface);
    root.style.setProperty('--app-surface-muted', theme.surfaceMuted);
    root.style.setProperty('--app-border', theme.border);
    root.style.setProperty('--app-text', theme.text);
    root.style.setProperty('--app-text-muted', theme.textMuted);
    root.style.setProperty('--app-accent', settings.accentColor);
    root.style.setProperty('--app-accent-soft', hexToSoftRgba(settings.accentColor, theme.isDark ? 0.2 : 0.1));
    root.style.setProperty('--app-accent-fg', '#FFFFFF');
  }, [settings]);

  // Persist documents locally as offline cache
  useEffect(() => {
    saveDocuments(docStore.documents, docStore.activeDocId);
  }, [docStore]);

  // Persist offline mode preference & pending sync queue
  useEffect(() => {
    saveOfflineModePref(manualOfflineMode);
  }, [manualOfflineMode]);

  useEffect(() => {
    savePendingSyncQueue(pendingQueue.upsertIds, pendingQueue.deleteIds);
  }, [pendingQueue]);

  useEffect(() => {
    savePaymentProfile(paymentProfile);
  }, [paymentProfile]);

  useEffect(() => {
    savePendingPaymentSync(pendingPaymentSync);
  }, [pendingPaymentSync]);

  const enqueueUpsertSeason = useCallback((seasonId: string) => {
    setPendingQueue((prev) => ({
      upsertIds: prev.upsertIds.includes(seasonId) ? prev.upsertIds : [...prev.upsertIds, seasonId],
      deleteIds: prev.deleteIds.filter((id) => id !== seasonId),
    }));
  }, []);

  const enqueueDeleteSeason = useCallback((seasonId: string) => {
    setPendingQueue((prev) => ({
      upsertIds: prev.upsertIds.filter((id) => id !== seasonId),
      deleteIds: prev.deleteIds.includes(seasonId) ? prev.deleteIds : [...prev.deleteIds, seasonId],
    }));
  }, []);

  const flushPendingDeltaForKey = useCallback(
    (key: string) => {
      const entry = pendingDeltaMapRef.current.get(key);
      if (!entry) return;
      window.clearTimeout(entry.timer);
      pendingDeltaMapRef.current.delete(key);

      const { seasonId, prevGh, nextGh, user, deviceLabel: label } = entry;
      const prevCount = inFlightDeltaSeasonRef.current.get(seasonId) || 0;
      inFlightDeltaSeasonRef.current.set(seasonId, prevCount + 1);

      void syncGreenhouseDeltaToCloud({
        user,
        seasonId,
        prevGh,
        nextGh,
        deviceLabel: label,
      })
        .then(() => {
          seasonEchoHoldUntilRef.current.delete(seasonId);
          setSyncError('');
        })
        .catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
          enqueueUpsertSeason(seasonId);
        })
        .finally(() => {
          const curr = inFlightDeltaSeasonRef.current.get(seasonId) || 1;
          if (curr <= 1) {
            inFlightDeltaSeasonRef.current.delete(seasonId);
            const hasMorePending = Array.from(pendingDeltaMapRef.current.values()).some(
              (item) => item.seasonId === seasonId
            );
            if (
              !hasMorePending &&
              skippedRemoteSeasonIdsRef.current.has(seasonId) &&
              !pendingQueueRef.current.upsertIds.includes(seasonId)
            ) {
              skippedRemoteSeasonIdsRef.current.delete(seasonId);
              const meta = cloudMetasRef.current.find((m) => m.id === seasonId);
              if (meta) {
                void fetchSeasonFromCloud(user.uid, meta)
                  .then((fresh) => {
                    if (!fresh) return;
                    if (
                      pendingQueueRef.current.upsertIds.includes(fresh.id) ||
                      (inFlightDeltaSeasonRef.current.get(fresh.id) || 0) > 0
                    ) {
                      return;
                    }
                    setDocStore((prev) => ({
                      ...prev,
                      documents: prev.documents.map((d) => (d.id === fresh.id ? fresh : d)),
                    }));
                  })
                  .catch(() => {
                    // ignore transient refresh fetch error
                  });
              }
            }
          } else {
            inFlightDeltaSeasonRef.current.set(seasonId, curr - 1);
          }
        });
    },
    [enqueueUpsertSeason]
  );

  const flushAllPendingDeltas = useCallback(() => {
    for (const key of Array.from(pendingDeltaMapRef.current.keys())) {
      flushPendingDeltaForKey(key);
    }
  }, [flushPendingDeltaForKey]);

  useEffect(() => {
    const handleVisibilityOrUnload = () => {
      if (document.visibilityState === 'hidden') {
        flushAllPendingDeltas();
      }
    };
    const handleBeforeUnload = () => {
      flushAllPendingDeltas();
    };
    document.addEventListener('visibilitychange', handleVisibilityOrUnload);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrUnload);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      flushAllPendingDeltas();
    };
  }, [flushAllPendingDeltas]);

  const flushPendingOfflineQueue = useCallback(async () => {
    if (!cloudUser || isEffectivelyOffline || flushingRef.current) return;
    const { upsertIds, deleteIds } = pendingQueueRef.current;
    const needPaymentSync = pendingPaymentSyncRef.current;
    if (upsertIds.length === 0 && deleteIds.length === 0 && !needPaymentSync) return;

    flushingRef.current = true;
    setSyncBusy(true);
    setSyncError('');
    try {
      const doneUpserts: string[] = [];
      const doneDeletes: string[] = [];

      for (const sId of upsertIds) {
        const localDoc = docStoreRef.current.documents.find((d) => d.id === sId);
        if (localDoc) {
          await uploadSeasonToCloud(cloudUser, localDoc, deviceLabel);
        }
        doneUpserts.push(sId);
      }

      for (const sId of deleteIds) {
        await deleteSeasonFromCloud(cloudUser, sId);
        doneDeletes.push(sId);
      }

      if (needPaymentSync) {
        await savePaymentProfileToCloud(cloudUser, paymentProfileRef.current, deviceLabel);
        setPendingPaymentSync(false);
      }

      setPendingQueue((prev) => ({
        upsertIds: prev.upsertIds.filter((id) => !doneUpserts.includes(id)),
        deleteIds: prev.deleteIds.filter((id) => !doneDeletes.includes(id)),
      }));
    } catch (err) {
      setSyncError(
        err
          ? parseFirestoreErrorMessage(err)
          : 'Sebagian data offline belum tersinkronkan. Akan dicoba lagi saat sinyal stabil.'
      );
    } finally {
      flushingRef.current = false;
      setSyncBusy(false);
    }
  }, [cloudUser, isEffectivelyOffline, deviceLabel]);

  // Auto-flush offline queue when connectivity & auth are ready
  useEffect(() => {
    if (authReady && cloudUser && !isEffectivelyOffline && pendingSyncCount > 0) {
      void flushPendingOfflineQueue();
    }
  }, [authReady, cloudUser, isEffectivelyOffline, pendingSyncCount, flushPendingOfflineQueue]);

  // Complete any redirect-based Google Auth flow (used on PWA / mobile WebViews)
  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      setSyncError(formatGoogleAuthError(err));
    });
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCloudUser(user);
      setAuthReady(true);
      setSyncError('');
      if (user && isBrowserOnline && !manualOfflineMode) {
        void upsertUserProfile(user).catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
        });
      } else if (!user) {
        setCloudMetas([]);
        setActivities([]);
        fetchedOtherSeasonUpdatedAtRef.current.clear();
        skippedRemoteSeasonIdsRef.current.clear();
      }
    });
    return () => unsub();
  }, [isBrowserOnline, manualOfflineMode]);

  // Subscribe to user's Cloud Seasons metadata when signed in & online
  useEffect(() => {
    if (!authReady || !cloudUser || isEffectivelyOffline) return;
    const unsub = subscribeUserSeasons(
      cloudUser.uid,
      (metas) => {
        setCloudMetas(metas);
        if (metas.length === 0 && !autoUploadedUsersRef.current.has(cloudUser.uid)) {
          autoUploadedUsersRef.current.add(cloudUser.uid);
          const currentLocal = docStoreRef.current.documents;
          setSyncBusy(true);
          void Promise.all(
            currentLocal.map((d) => uploadSeasonToCloud(cloudUser, d, deviceLabel))
          )
            .catch((err) => {
              setSyncError(parseFirestoreErrorMessage(err));
            })
            .finally(() => setSyncBusy(false));
        } else if (metas.length > 0) {
          const pendingUpserts = new Set(pendingQueueRef.current.upsertIds);
          const pendingDeletes = new Set(pendingQueueRef.current.deleteIds);
          const visibleMetas = metas.filter((m) => !pendingDeletes.has(m.id));
          if (visibleMetas.length === 0) return;

          setDocStore((prev) => {
            const existsInCloud = visibleMetas.some((m) => m.id === prev.activeDocId);
            const nextActiveId =
              existsInCloud || pendingUpserts.has(prev.activeDocId)
                ? prev.activeDocId
                : visibleMetas[0].id;
            const mergedDocs = visibleMetas.map((meta) => {
              const existing = prev.documents.find((d) => d.id === meta.id);
              if (existing) {
                if (pendingUpserts.has(meta.id)) {
                  return existing;
                }
                return {
                  ...existing,
                  title: meta.title,
                  notes: meta.notes,
                  updatedAt: meta.updatedAt,
                };
              }
              const fallbackGhs =
                prev.documents[0]?.greenhouses?.length
                  ? prev.documents[0].greenhouses
                  : docStoreRef.current.documents[0]?.greenhouses?.length
                  ? docStoreRef.current.documents[0].greenhouses
                  : [
                      createGreenhouse(
                        meta.activeGhId || 'gh-1',
                        'GH 1',
                        'Melon Inthanon RZ',
                        1000,
                        'semai',
                        600,
                        6.6,
                        1,
                        true
                      ),
                    ];
              return {
                id: meta.id,
                title: meta.title,
                createdAt: meta.createdAt,
                updatedAt: meta.updatedAt,
                notes: meta.notes,
                activeGhId: meta.activeGhId || fallbackGhs[0].id,
                greenhouses: fallbackGhs,
              };
            });
            // Preserve locally created offline documents not yet uploaded
            const localOnlyPending = prev.documents.filter(
              (d) => pendingUpserts.has(d.id) && !mergedDocs.some((m) => m.id === d.id)
            );
            return {
              documents: [...localOnlyPending, ...mergedDocs],
              activeDocId: nextActiveId,
            };
          });
        }
      },
      (msg) => setSyncError(msg)
    );
    return () => unsub();
  }, [authReady, cloudUser, isEffectivelyOffline, deviceLabel]);

  // Hydrate currently selected Cloud Season in real-time (skipped while offline or pending upload)
  const activeCloudMeta = useMemo(
    () => cloudMetas.find((m) => m.id === docStore.activeDocId) || cloudMetas[0] || null,
    [cloudMetas, docStore.activeDocId]
  );
  activeCloudMetaRef.current = activeCloudMeta;
  const activeCloudSeasonId = activeCloudMeta?.id || '';

  useEffect(() => {
    if (!authReady || !cloudUser || !activeCloudSeasonId || isEffectivelyOffline) return;
    const initialMeta = activeCloudMetaRef.current;
    if (!initialMeta) return;
    const unsub = subscribeSeasonRealtime(
      cloudUser.uid,
      () => activeCloudMetaRef.current || initialMeta,
      (hydratedSeason) => {
        // Protect locally modified offline/pending documents & prevent cloud echo clobbering mid-typing
        const hasPendingDelta = Array.from(pendingDeltaMapRef.current.values()).some(
          (item) => item.seasonId === hydratedSeason.id
        );
        const hasInFlightDelta =
          (inFlightDeltaSeasonRef.current.get(hydratedSeason.id) || 0) > 0;
        const holdUntil = seasonEchoHoldUntilRef.current.get(hydratedSeason.id) || 0;
        if (
          pendingQueueRef.current.upsertIds.includes(hydratedSeason.id) ||
          hasPendingDelta ||
          hasInFlightDelta ||
          Date.now() < holdUntil
        ) {
          skippedRemoteSeasonIdsRef.current.add(hydratedSeason.id);
          return;
        }
        skippedRemoteSeasonIdsRef.current.delete(hydratedSeason.id);
        setDocStore((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === hydratedSeason.id ? hydratedSeason : d
          ),
        }));
      },
      (acts) => setActivities(acts),
      (msg) => setSyncError(msg)
    );
    return () => unsub();
  }, [authReady, cloudUser, activeCloudSeasonId, isEffectivelyOffline]);

  // Hydrate non-active seasons on secondary devices & refresh when updatedAt changes
  useEffect(() => {
    if (!authReady || !cloudUser || isEffectivelyOffline || cloudMetas.length <= 1) return;
    const otherMetas = cloudMetas.filter(
      (m) =>
        m.id !== activeCloudSeasonId &&
        !pendingQueueRef.current.upsertIds.includes(m.id) &&
        fetchedOtherSeasonUpdatedAtRef.current.get(m.id) !== m.updatedAt
    );
    if (otherMetas.length === 0) return;

    let cancelled = false;
    otherMetas.forEach((m) => fetchedOtherSeasonUpdatedAtRef.current.set(m.id, m.updatedAt));

    void Promise.all(
      otherMetas.map(async (meta) => {
        try {
          const hydrated = await fetchSeasonFromCloud(cloudUser.uid, meta);
          if (!hydrated || cancelled) return;
          if (pendingQueueRef.current.upsertIds.includes(hydrated.id)) return;
          setDocStore((prev) => ({
            ...prev,
            documents: prev.documents.map((d) => (d.id === hydrated.id ? hydrated : d)),
          }));
        } catch {
          fetchedOtherSeasonUpdatedAtRef.current.delete(meta.id);
        }
      })
    );

    return () => {
      cancelled = true;
    };
  }, [authReady, cloudUser, isEffectivelyOffline, cloudMetas, activeCloudSeasonId]);

  // Subscribe to QRIS & Bank Payment Profile across devices sharing the same Google Account
  useEffect(() => {
    if (!authReady || !cloudUser || isEffectivelyOffline) return;
    const unsub = subscribePaymentProfileRealtime(
      cloudUser.uid,
      (cloudProfile) => {
        if (cloudProfile) {
          if (!pendingPaymentSyncRef.current) {
            setPaymentProfile(cloudProfile);
          }
        } else {
          const local = paymentProfileRef.current;
          const hasCustomLocalData =
            Boolean(local.bankName.trim()) ||
            Boolean(local.accountNumber.trim()) ||
            Boolean(local.accountHolderName.trim()) ||
            Boolean(local.qrisImageDataUrl) ||
            Boolean(local.storePhone.trim()) ||
            Boolean(local.storeAddress.trim()) ||
            local.storeName !== DEFAULT_PAYMENT_PROFILE.storeName ||
            local.footerNote !== DEFAULT_PAYMENT_PROFILE.footerNote;
          if (hasCustomLocalData) {
            void savePaymentProfileToCloud(cloudUser, local, deviceLabel).catch(() => {
              setPendingPaymentSync(true);
            });
          }
        }
      },
      (msg) => setSyncError(msg)
    );
    return () => unsub();
  }, [authReady, cloudUser, isEffectivelyOffline, deviceLabel]);

  const handleUpdatePaymentProfile = useCallback(
    (next: SelfSalePaymentProfile) => {
      const qrisChanged = next.qrisImageDataUrl !== paymentProfileRef.current.qrisImageDataUrl;
      setPaymentProfile(next);

      if (!cloudUser) return;
      if (isEffectivelyOffline) {
        setPendingPaymentSync(true);
        return;
      }

      if (paymentSyncTimerRef.current !== null) {
        window.clearTimeout(paymentSyncTimerRef.current);
        paymentSyncTimerRef.current = null;
      }

      const push = () => {
        void savePaymentProfileToCloud(cloudUser, next, deviceLabel)
          .then(() => {
            setPendingPaymentSync(false);
          })
          .catch(() => {
            setPendingPaymentSync(true);
          });
      };

      if (qrisChanged) {
        push();
      } else {
        paymentSyncTimerRef.current = window.setTimeout(push, 500);
      }
    },
    [cloudUser, isEffectivelyOffline, deviceLabel]
  );

  const handlePrintReceiptSheet = useCallback((receipt: SelfSaleReceipt) => {
    setActivePrintReceipt(receipt);
    const cleanup = () => {
      setActivePrintReceipt(null);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.setTimeout(() => {
      window.print();
    }, 90);
  }, []);

  const handleSignInGoogle = async () => {
    if (!isBrowserOnline) {
      setSyncError('Perangkat sedang offline. Hubungkan internet terlebih dahulu untuk masuk Akun Google.');
      return;
    }
    setManualOfflineMode(false);
    setSyncBusy(true);
    setSyncError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          setSyncError(formatGoogleAuthError(redirectErr));
        }
      } else {
        setSyncError(formatGoogleAuthError(err));
      }
    } finally {
      setSyncBusy(false);
    }
  };

  const handleSignOutGoogle = async () => {
    flushAllPendingDeltas();
    setSyncBusy(true);
    setSyncError('');
    try {
      await signOut(auth);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Gagal keluar dari Akun Google.');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleChangeDeviceLabel = (label: string) => {
    setDeviceLabel(saveDeviceLabel(label));
  };

  const handleToggleManualOffline = () => {
    if (!manualOfflineMode && isBrowserOnline && cloudUser) {
      flushAllPendingDeltas();
    }
    setManualOfflineMode((prev) => !prev);
    setSyncError('');
  };

  const handleUploadLocalToCloud = async () => {
    if (!cloudUser) return;
    if (isEffectivelyOffline) {
      setSyncError('Mode Offline aktif / tidak ada internet. Data tetap tersimpan aman di perangkat.');
      return;
    }
    flushAllPendingDeltas();
    setSyncBusy(true);
    setSyncError('');
    try {
      for (const docItem of docStore.documents) {
        await uploadSeasonToCloud(cloudUser, docItem, deviceLabel);
      }
      await savePaymentProfileToCloud(cloudUser, paymentProfileRef.current, deviceLabel);
      setPendingQueue({ upsertIds: [], deleteIds: [] });
      setPendingPaymentSync(false);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Gagal mengunggah data lokal ke Cloud.');
    } finally {
      setSyncBusy(false);
    }
  };

  // Evaluate notifications
  const alerts = useMemo(() => {
    return evaluateGreenhouseAlerts(activeGh, settings.notifications);
  }, [activeGh, settings.notifications]);

  const visibleAlerts = useMemo(() => {
    return alerts.filter((a) => !dismissedAlertIds.includes(a.id));
  }, [alerts, dismissedAlertIds]);

  const prevCriticalSigRef = useRef<string>('');
  useEffect(() => {
    const criticalAlerts = alerts.filter((a) => a.level === 'critical');
    const sig = criticalAlerts.map((a) => `${a.id}:${a.title}`).join('|');
    if (sig && sig !== prevCriticalSigRef.current) {
      if (prevCriticalSigRef.current !== '') {
        if (settings.notifications.soundEnabled) {
          playNotificationChime('critical');
        }
        if (settings.notifications.browserNotify) {
          sendBrowserNotification(criticalAlerts[0].title, criticalAlerts[0].message);
        }
      }
      // Clear dismissed state for newly triggered critical alert
      setDismissedAlertIds((prev) =>
        prev.filter((id) => !criticalAlerts.some((a) => a.id === id))
      );
    }
    prevCriticalSigRef.current = sig;
  }, [alerts, settings.notifications.soundEnabled, settings.notifications.browserNotify]);

  // Helpers to mutate active document / active GH (with real-time Firestore push)
  const updateActiveDoc = (updater: (doc: SeasonDocument) => SeasonDocument) => {
    setDocStore((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === prev.activeDocId ? { ...updater(d), updatedAt: new Date().toISOString() } : d
      ),
    }));
  };

  const updateActiveGh = (updater: (gh: GreenhouseData) => GreenhouseData) => {
    const latestStore = docStoreRef.current;
    const currentSeason =
      latestStore.documents.find((d) => d.id === latestStore.activeDocId) ||
      latestStore.documents[0];
    if (!currentSeason) return;
    const prevGh =
      currentSeason.greenhouses.find((g) => g.id === currentSeason.activeGhId) ||
      currentSeason.greenhouses[0];
    if (!prevGh) return;

    const nextGh = updater(prevGh);
    const updatedStore = {
      ...latestStore,
      documents: latestStore.documents.map((d) =>
        d.id === currentSeason.id
          ? {
              ...d,
              updatedAt: new Date().toISOString(),
              greenhouses: d.greenhouses.map((g) => (g.id === prevGh.id ? nextGh : g)),
            }
          : d
      ),
    };
    docStoreRef.current = updatedStore;
    setDocStore(updatedStore);

    if (cloudUser) {
      if (isEffectivelyOffline) {
        enqueueUpsertSeason(currentSeason.id);
      } else {
        const key = `${currentSeason.id}::${prevGh.id}`;
        const existing = pendingDeltaMapRef.current.get(key);
        if (existing) {
          window.clearTimeout(existing.timer);
        }
        const timer = window.setTimeout(() => {
          flushPendingDeltaForKey(key);
        }, 480);
        pendingDeltaMapRef.current.set(key, {
          seasonId: currentSeason.id,
          ghId: prevGh.id,
          prevGh: existing ? existing.prevGh : prevGh,
          nextGh,
          user: cloudUser,
          deviceLabel,
          timer,
        });
        seasonEchoHoldUntilRef.current.set(currentSeason.id, Date.now() + 2500);
      }
    }
  };

  const handleSelectGh = (ghId: string) => {
    flushAllPendingDeltas();
    const seasonId = activeDoc.id;
    updateActiveDoc((doc) => ({ ...doc, activeGhId: ghId }));
    if (cloudUser) {
      if (isEffectivelyOffline) {
        enqueueUpsertSeason(seasonId);
      } else {
        void updateActiveGhInCloud(cloudUser, seasonId, ghId, deviceLabel).catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
          enqueueUpsertSeason(seasonId);
        });
      }
    }
  };

  const handleAddGh = (payload: {
    name: string;
    variety: string;
    capacity: number;
    gulliesCount: number;
    reservoirLiters: number;
    plantingDate: string;
    harvestDate: string;
    phase: GrowthPhase;
    ppm: number;
    ph: number;
  }) => {
    const newId = `gh-${Date.now()}`;
    const created = createGreenhouse(
      newId,
      payload.name,
      payload.variety,
      payload.capacity,
      payload.phase,
      payload.ppm,
      payload.ph,
      activeDoc.greenhouses.length + 1,
      true
    );
    created.gulliesCount = payload.gulliesCount;
    created.reservoirLiters = payload.reservoirLiters;
    created.plantingDate = payload.plantingDate;
    created.harvestDate = payload.harvestDate;

    const nextOrder = [...activeDoc.greenhouses.map((g) => g.id), newId];
    updateActiveDoc((doc) => ({
      ...doc,
      activeGhId: newId,
      greenhouses: [...doc.greenhouses, created],
    }));

    if (cloudUser) {
      if (isEffectivelyOffline) {
        enqueueUpsertSeason(activeDoc.id);
      } else {
        void addGreenhouseToCloud(cloudUser, activeDoc.id, created, nextOrder, deviceLabel).catch(
          (err) => {
            setSyncError(parseFirestoreErrorMessage(err));
            enqueueUpsertSeason(activeDoc.id);
          }
        );
      }
    }
  };

  const handleEditGh = (payload: {
    name: string;
    variety: string;
    capacity: number;
    gulliesCount: number;
    reservoirLiters: number;
    plantingDate: string;
    harvestDate: string;
    phase: GrowthPhase;
    ppm: number;
    ph: number;
  }) => {
    updateActiveGh((prev) => {
      let nextPlants = prev.plants;
      if (payload.capacity !== prev.plants.length) {
        if (payload.capacity > prev.plants.length) {
          const extra = generatePlants(
            payload.capacity,
            1,
            payload.phase,
            true
          ).slice(prev.plants.length);
          nextPlants = [...prev.plants, ...extra];
        } else {
          nextPlants = prev.plants.slice(0, payload.capacity);
        }
      }
      return {
        ...prev,
        name: payload.name,
        variety: payload.variety,
        capacity: payload.capacity,
        gulliesCount: payload.gulliesCount,
        reservoirLiters: payload.reservoirLiters,
        plantingDate: payload.plantingDate,
        harvestDate: payload.harvestDate,
        phase: payload.phase,
        currentWater: {
          ...prev.currentWater,
          ppm: payload.ppm,
          ec: Number((payload.ppm / prev.ecFactor).toFixed(2)),
          ph: payload.ph,
        },
        plants: nextPlants,
      };
    });
  };

  const handleDeleteGh = (ghId: string) => {
    if (activeDoc.greenhouses.length <= 1) return;
    const deletedGh = activeDoc.greenhouses.find((g) => g.id === ghId);
    const remaining = activeDoc.greenhouses.filter((g) => g.id !== ghId);
    const nextActiveId = remaining[0].id;
    const nextOrder = remaining.map((g) => g.id);

    updateActiveDoc((doc) => ({
      ...doc,
      activeGhId: nextActiveId,
      greenhouses: remaining,
    }));

    if (cloudUser && deletedGh) {
      if (isEffectivelyOffline) {
        enqueueUpsertSeason(activeDoc.id);
      } else {
        void deleteGreenhouseFromCloud(
          cloudUser,
          activeDoc.id,
          ghId,
          deletedGh.name,
          nextActiveId,
          nextOrder,
          deviceLabel
        ).catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
          enqueueUpsertSeason(activeDoc.id);
        });
      }
    }
  };

  const handleCreateNewDocument = (payload: {
    title: string;
    notes: string;
    keepGhStructure: boolean;
    ghCount: number;
  }) => {
    const now = new Date().toISOString();
    const greenhouses: GreenhouseData[] = payload.keepGhStructure
      ? activeDoc.greenhouses.map((g, idx) =>
          createGreenhouse(
            `gh-${idx + 1}-${Date.now()}`,
            g.name,
            g.variety,
            g.capacity,
            'semai',
            700,
            6.7,
            idx + 1,
            true
          )
        )
      : Array.from({ length: payload.ghCount }).map((_, idx) =>
          createGreenhouse(
            `gh-${idx + 1}-${Date.now()}`,
            `GH ${idx + 1}`,
            'Melon Inthanon RZ',
            1000,
            'semai',
            700,
            6.7,
            idx + 1,
            true
          )
        );

    const newDoc: SeasonDocument = {
      id: `season-${Date.now()}`,
      title: payload.title,
      createdAt: now,
      updatedAt: now,
      notes: payload.notes,
      activeGhId: greenhouses[0].id,
      greenhouses,
    };

    setDocStore((prev) => ({
      documents: [newDoc, ...prev.documents],
      activeDocId: newDoc.id,
    }));

    if (cloudUser) {
      if (isEffectivelyOffline) {
        enqueueUpsertSeason(newDoc.id);
      } else {
        void uploadSeasonToCloud(cloudUser, newDoc, deviceLabel).catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
          enqueueUpsertSeason(newDoc.id);
        });
      }
    }
  };

  const handleSelectDocument = (docId: string) => {
    flushAllPendingDeltas();
    setDocStore((prev) => ({ ...prev, activeDocId: docId }));
  };

  const handleDeleteDocument = (docId: string) => {
    setDocStore((prev) => {
      if (prev.documents.length <= 1) return prev;
      const remaining = prev.documents.filter((d) => d.id !== docId);
      const nextActive = prev.activeDocId === docId ? remaining[0].id : prev.activeDocId;
      return { documents: remaining, activeDocId: nextActive };
    });
    if (cloudUser && docStore.documents.length > 1) {
      if (isEffectivelyOffline) {
        enqueueDeleteSeason(docId);
      } else {
        void deleteSeasonFromCloud(cloudUser, docId).catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
          enqueueDeleteSeason(docId);
        });
      }
    }
  };

  const handleDeleteSelectedDocuments = (docIds: string[]) => {
    if (docIds.length === 0) return;
    const activeFallbackId = docStore.activeDocId;
    const toDeleteInCloud: string[] = [];
    setDocStore((prev) => {
      const idSet = new Set(docIds);
      const remaining = prev.documents.filter((d) => !idSet.has(d.id));
      // Pastikan selalu menyisakan minimal 1 dokumen aktif agar aplikasi tetap berjalan
      if (remaining.length === 0) {
        const activeFallback = prev.documents.find((d) => d.id === prev.activeDocId) || prev.documents[0];
        prev.documents.forEach((d) => {
          if (d.id !== activeFallback.id) toDeleteInCloud.push(d.id);
        });
        return { documents: [activeFallback], activeDocId: activeFallback.id };
      }
      docIds.forEach((id) => {
        if (prev.documents.some((d) => d.id === id)) toDeleteInCloud.push(id);
      });
      const nextActive = idSet.has(prev.activeDocId) ? remaining[0].id : prev.activeDocId;
      return { documents: remaining, activeDocId: nextActive };
    });
    if (cloudUser && toDeleteInCloud.length > 0) {
      toDeleteInCloud
        .filter((id) => docStore.documents.length > 1 || id !== activeFallbackId)
        .forEach((id) => {
          if (isEffectivelyOffline) {
            enqueueDeleteSeason(id);
          } else {
            void deleteSeasonFromCloud(cloudUser, id).catch((err) => {
              setSyncError(parseFirestoreErrorMessage(err));
              enqueueDeleteSeason(id);
            });
          }
        });
    }
  };

  const handleDeleteAllArchivedDocuments = () => {
    const keepId = docStore.activeDocId;
    const toDelete = docStore.documents.filter((d) => d.id !== keepId).map((d) => d.id);
    setDocStore((prev) => {
      const activeOnly = prev.documents.find((d) => d.id === prev.activeDocId) || prev.documents[0];
      return { documents: [activeOnly], activeDocId: activeOnly.id };
    });
    if (cloudUser) {
      toDelete.forEach((id) => {
        if (isEffectivelyOffline) {
          enqueueDeleteSeason(id);
        } else {
          void deleteSeasonFromCloud(cloudUser, id).catch((err) => {
            setSyncError(parseFirestoreErrorMessage(err));
            enqueueDeleteSeason(id);
          });
        }
      });
    }
  };

  const handleImportDocument = (doc: SeasonDocument) => {
    const normalized = normalizeSeasonDocument(doc);
    setDocStore((prev) => ({
      documents: [normalized, ...prev.documents],
      activeDocId: normalized.id,
    }));
    if (cloudUser) {
      if (isEffectivelyOffline) {
        enqueueUpsertSeason(normalized.id);
      } else {
        void uploadSeasonToCloud(cloudUser, normalized, deviceLabel).catch((err) => {
          setSyncError(parseFirestoreErrorMessage(err));
          enqueueUpsertSeason(normalized.id);
        });
      }
    }
  };

  const hstDays = useMemo(() => {
    const start = new Date(activeGh.plantingDate).getTime();
    if (Number.isNaN(start)) return 0;
    return Math.max(0, Math.floor((Date.now() - start) / 86400000));
  }, [activeGh.plantingDate]);

  const activeTabIndex = DASHBOARD_ORDER.indexOf(activeTab);

  const goRelativeDashboard = useCallback(
    (delta: -1 | 1) => {
      const idx = DASHBOARD_ORDER.indexOf(activeTab);
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= DASHBOARD_ORDER.length) return;
      setActiveTab(DASHBOARD_ORDER[nextIdx]);
      if (typeof window !== 'undefined' && window.scrollY > 180) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [activeTab]
  );

  const handleMainTouchStart = (e: TouchEvent<HTMLElement>) => {
    const anyModalOpen =
      settingsOpen ||
      ghModalState.open ||
      newDocOpen ||
      printOpen ||
      mobileApkOpen ||
      accountModalOpen;
    if (anyModalOpen || e.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }
    if (hasHorizontalScrollAncestor(e.target, e.currentTarget)) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleMainTouchEnd = (e: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || e.changedTouches.length === 0) return;

    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const elapsed = Date.now() - start.time;

    if (Math.abs(dx) >= 65 && Math.abs(dx) > Math.abs(dy) * 1.5 && elapsed < 750) {
      if (dx < 0) {
        goRelativeDashboard(1);
      } else {
        goRelativeDashboard(-1);
      }
    }
  };

  return (
    <div
      className="min-h-screen transition-colors"
      style={{
        backgroundColor: 'var(--app-canvas)',
        color: 'var(--app-text)',
      }}
    >
      {/* Top Toolbar */}
      <TopToolbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        document={activeDoc}
        activeGh={activeGh}
        onSelectGh={handleSelectGh}
        onOpenGhModal={(mode) => setGhModalState({ open: true, mode })}
        onOpenNewDocModal={() => setNewDocOpen(true)}
        onOpenPrintModal={() => setPrintOpen(true)}
        onOpenSettingsModal={() => setSettingsOpen(true)}
        onOpenMobileApkModal={() => setMobileApkOpen(true)}
        onOpenAccountModal={() => setAccountModalOpen(true)}
        cloudUser={cloudUser}
        syncBusy={syncBusy}
        isBrowserOnline={isBrowserOnline}
        manualOfflineMode={manualOfflineMode}
        pendingSyncCount={pendingSyncCount}
        onToggleManualOffline={handleToggleManualOffline}
        alerts={alerts}
      />

      {/* Main Screen Content (hidden on print, supports horizontal swipe between dashboards) */}
      <main
        onTouchStart={handleMainTouchStart}
        onTouchEnd={handleMainTouchEnd}
        className="no-print mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6 touch-pan-y"
      >
        {/* Season & Greenhouse Switcher Bar */}
        <section
          className="rounded-xl border p-4 sm:px-5 sm:py-4"
          style={{
            backgroundColor: 'var(--app-surface)',
            borderColor: 'var(--app-border)',
          }}
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                <span className="font-semibold" style={{ color: 'var(--app-accent)' }}>
                  {activeDoc.title}
                </span>
                <span aria-hidden="true">·</span>
                <span>Varietas {activeGh.variety}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-tabular">
                  {hstDays} HST (Tanam {activeGh.plantingDate})
                </span>
                <span aria-hidden="true">·</span>
                <span>{(GROWTH_PHASE_SPECS[activeGh.phase] || GROWTH_PHASE_SPECS.vegetatif).label}</span>
                {cloudUser && (
                  <>
                    <span aria-hidden="true">·</span>
                    <button
                      type="button"
                      onClick={() => setAccountModalOpen(true)}
                      className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-300 underline cursor-pointer"
                    >
                      <Cloud className="h-3 w-3" />
                      {cloudUser.email} ({deviceLabel})
                    </button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">
                  {activeTab === 'water' && `${activeGh.name} — Kontrol PPM & pH Larutan NFT`}
                  {activeTab === 'treatment' && `${activeGh.name} — Perawatan Penyemprotan, Pengolesan & Pengocoran`}
                  {activeTab === 'plants' && `${activeGh.name} — Pemantauan Kondisi Tanaman 1 s/d ${activeGh.capacity}`}
                  {activeTab === 'accounting' && `${activeGh.name} — Pembukuan Melon (Biaya, Penjualan & Keuntungan)`}
                </h1>
                <div className="flex items-center gap-1.5 xl:hidden">
                  <button
                    type="button"
                    disabled={activeTabIndex <= 0}
                    onClick={() => goRelativeDashboard(-1)}
                    aria-label="Dashboard sebelumnya"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-35 cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface-muted)',
                      color: 'var(--app-text)',
                    }}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span
                    className="text-[11px] font-medium whitespace-nowrap"
                    style={{ color: 'var(--app-text-muted)' }}
                  >
                    Geser ({activeTabIndex + 1}/4)
                  </span>
                  <button
                    type="button"
                    disabled={activeTabIndex >= DASHBOARD_ORDER.length - 1}
                    onClick={() => goRelativeDashboard(1)}
                    aria-label="Dashboard berikutnya"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border disabled:opacity-35 cursor-pointer"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface-muted)',
                      color: 'var(--app-text)',
                    }}
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {cloudUser && activities[0] && (
                <button
                  type="button"
                  onClick={() => setAccountModalOpen(true)}
                  className="text-left text-[11px] cursor-pointer hover:underline"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  Pantauan terbaru ({activities[0].deviceLabel}): {activities[0].summary}
                </button>
              )}
              {/* Inline Manual Harvest Date Input */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <label
                  htmlFor="gh-harvest-date-inline"
                  className="text-xs font-medium"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  Tanggal Panen (Isi Manual):
                </label>
                <div className="inline-flex items-center gap-1.5">
                  <input
                    id="gh-harvest-date-inline"
                    type="date"
                    value={activeGh.harvestDate || ''}
                    onChange={(e) =>
                      updateActiveGh((prev) => ({
                        ...prev,
                        harvestDate: e.target.value,
                      }))
                    }
                    className="h-8 rounded-lg border px-2.5 text-xs font-mono-tabular focus:outline-none"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-canvas)',
                      color: 'var(--app-text)',
                    }}
                  />
                  {activeGh.harvestDate ? (
                    <button
                      type="button"
                      onClick={() =>
                        updateActiveGh((prev) => ({ ...prev, harvestDate: '' }))
                      }
                      className="rounded-md border px-2 py-1 text-[11px] font-medium cursor-pointer"
                      style={{
                        borderColor: 'var(--app-border)',
                        color: 'var(--app-text-muted)',
                      }}
                    >
                      Hapus
                    </button>
                  ) : (
                    <span className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                      Belum diisi
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick GH Tabs + Manual Add/Edit */}
            <div className="flex flex-wrap items-center gap-1.5">
              {activeDoc.greenhouses.map((gh) => {
                const selected = gh.id === activeGh.id;
                return (
                  <button
                    key={gh.id}
                    type="button"
                    onClick={() => handleSelectGh(gh.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: selected ? 'var(--app-accent)' : 'var(--app-border)',
                      backgroundColor: selected ? 'var(--app-accent)' : 'var(--app-surface-muted)',
                      color: selected ? 'var(--app-accent-fg)' : 'var(--app-text)',
                    }}
                  >
                    {gh.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setGhModalState({ open: true, mode: 'edit' })}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-text-muted)',
                }}
              >
                <Edit3 className="h-3.5 w-3.5" />
                Manual GH
              </button>
              <button
                type="button"
                onClick={() => setGhModalState({ open: true, mode: 'add' })}
                className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                style={{
                  borderColor: 'var(--app-border)',
                  color: 'var(--app-accent)',
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah GH
              </button>
            </div>
          </div>
        </section>

        {/* Cloud Sync / Auth Error Banner */}
        {syncError && (
          <section
            className="flex flex-col gap-2 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <div className="flex items-start gap-2.5 text-rose-700 dark:text-rose-200">
              <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-xs leading-relaxed">
                <div className="font-bold">Sinkronisasi Cloud Membutuhkan Perhatian</div>
                <div>{syncError}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setAccountModalOpen(true)}
                className="rounded-lg border border-rose-500/40 bg-white/80 dark:bg-black/30 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-200 cursor-pointer"
              >
                Cek Akun & Sinkronisasi
              </button>
              <button
                type="button"
                onClick={() => setSyncError('')}
                className="text-xs font-medium underline text-rose-700 dark:text-rose-200 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </section>
        )}

        {/* Active Threshold Alerts Banner */}
        {visibleAlerts.length > 0 && (
          <section className="space-y-2" aria-label="Peringatan aktif">
            {visibleAlerts.map((alert) => {
              const isCritical = alert.level === 'critical';
              const isWarning = alert.level === 'warning';
              return (
                <div
                  key={alert.id}
                  className="flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    backgroundColor: 'var(--app-surface)',
                    borderColor: isCritical ? '#DC2626' : isWarning ? '#D97706' : 'var(--app-border)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    {isCritical ? (
                      <BellRing className="mt-0.5 h-4 w-4 text-rose-600 shrink-0" />
                    ) : isWarning ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
                    )}
                    <div>
                      <div className="text-xs font-bold">{alert.title}</div>
                      <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                        {alert.message}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedAlertIds((prev) => [...prev, alert.id])}
                    className="self-end sm:self-center text-xs font-medium underline cursor-pointer shrink-0"
                    style={{ color: 'var(--app-text-muted)' }}
                  >
                    Tutup
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {/* Active Dashboard View */}
        {activeTab === 'water' && (
          <DashboardWaterControl
            gh={activeGh}
            notifSettings={settings.notifications}
            onUpdateGh={updateActiveGh}
          />
        )}

        {activeTab === 'treatment' && (
          <DashboardTreatments
            gh={activeGh}
            onUpdateGh={updateActiveGh}
          />
        )}

        {activeTab === 'plants' && (
          <DashboardPlantsMatrix
            gh={activeGh}
            onUpdateGh={updateActiveGh}
          />
        )}

        {activeTab === 'accounting' && (
          <DashboardAccounting
            document={activeDoc}
            allDocuments={docStore.documents}
            gh={activeGh}
            onUpdateGh={updateActiveGh}
            paymentProfile={paymentProfile}
            onUpdatePaymentProfile={handleUpdatePaymentProfile}
            onPrintReceiptSheet={handlePrintReceiptSheet}
            cloudEmail={cloudUser?.email || null}
            onOpenAccountSync={() => setAccountModalOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <SettingsModal
        isOpen={settingsOpen}
        settings={settings}
        onUpdateSettings={setSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <GreenhouseModal
        isOpen={ghModalState.open}
        mode={ghModalState.mode}
        activeGh={activeGh}
        ghCount={activeDoc.greenhouses.length}
        onSaveNew={handleAddGh}
        onSaveEdit={handleEditGh}
        onDeleteGh={handleDeleteGh}
        onClose={() => setGhModalState((prev) => ({ ...prev, open: false }))}
      />

      <NewDocumentModal
        isOpen={newDocOpen}
        documents={docStore.documents}
        activeDocId={docStore.activeDocId}
        onCreateNewDocument={handleCreateNewDocument}
        onSelectDocument={handleSelectDocument}
        onDeleteDocument={handleDeleteDocument}
        onDeleteSelectedDocuments={handleDeleteSelectedDocuments}
        onDeleteAllArchivedDocuments={handleDeleteAllArchivedDocuments}
        onImportDocument={handleImportDocument}
        onClose={() => setNewDocOpen(false)}
      />

      <PrintModal
        isOpen={printOpen}
        document={activeDoc}
        allDocuments={docStore.documents}
        activeGh={activeGh}
        activeTab={activeTab}
        printSelection={printSelection}
        onChangePrintSelection={setPrintSelection}
        onClose={() => setPrintOpen(false)}
      />

      <MobileApkModal
        isOpen={mobileApkOpen}
        onClose={() => setMobileApkOpen(false)}
      />

      <AccountSyncModal
        isOpen={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        user={cloudUser}
        authReady={authReady}
        syncBusy={syncBusy}
        syncError={syncError}
        deviceLabel={deviceLabel}
        onChangeDeviceLabel={handleChangeDeviceLabel}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOutGoogle}
        onUploadLocalToCloud={handleUploadLocalToCloud}
        activities={activities}
        lastModifiedBy={activeCloudMeta?.lastModifiedBy || ''}
        localDocCount={docStore.documents.length}
        isBrowserOnline={isBrowserOnline}
        manualOfflineMode={manualOfflineMode}
        pendingSyncCount={pendingSyncCount}
        onToggleManualOffline={handleToggleManualOffline}
        onSyncPendingNow={flushPendingOfflineQueue}
      />

      <OfflineIndicator
        isBrowserOnline={isBrowserOnline}
        manualOfflineMode={manualOfflineMode}
        pendingCount={pendingSyncCount}
        syncBusy={syncBusy}
        isSignedIn={Boolean(cloudUser)}
        onExitManualOffline={() => setManualOfflineMode(false)}
        onSyncNow={() => void flushPendingOfflineQueue()}
      />

      {/* Dedicated Print Output: Standalone Nota Jual Sendiri OR A4 Full Report */}
      {activePrintReceipt ? (
        <PrintableReceipt
          receipt={activePrintReceipt}
          paymentProfile={paymentProfile}
        />
      ) : (
        <PrintableReport
          document={activeDoc}
          allDocuments={docStore.documents}
          activeGh={activeGh}
          printSelection={printSelection}
        />
      )}
    </div>
  );
}
