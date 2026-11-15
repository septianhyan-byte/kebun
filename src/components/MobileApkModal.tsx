import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FolderArchive,
  RefreshCw,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { downloadAndroidApkBuildKit } from '../utils/androidKit';

interface MobileApkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ManifestDiagnostic {
  status: 'checking' | 'ok' | 'error';
  hasLinkTag: boolean;
  manifestOk: boolean;
  swOk: boolean;
  manifestName?: string;
  iconCount?: number;
  errorDetail?: string;
}

export const MobileApkModal: React.FC<MobileApkModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [downloadingKit, setDownloadingKit] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState('');

  const basePath = import.meta.env.BASE_URL || '/';
  const originUrl =
    typeof window !== 'undefined'
      ? new URL(basePath, window.location.origin).href.replace(/\/+$/, '')
      : '';
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isPrivateDevHost =
    hostname.startsWith('ais-dev-') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1';

  const suggestedSharedUrl = hostname.startsWith('ais-dev-')
    ? originUrl.replace('://ais-dev-', '://ais-pre-')
    : originUrl;

  const [pwabuilderUrl, setPwabuilderUrl] = useState(suggestedSharedUrl);
  const [diag, setDiag] = useState<ManifestDiagnostic>({
    status: 'checking',
    hasLinkTag: false,
    manifestOk: false,
    swOk: false,
  });

  const runDiagnostic = async () => {
    setDiag((prev) => ({ ...prev, status: 'checking' }));
    try {
      const linkTag = document.querySelector('link[rel="manifest"]');
      const manifestHref = linkTag?.getAttribute('href') || `${basePath}manifest.webmanifest`;
      const resp = await fetch(manifestHref, { cache: 'no-store' });
      const data = resp.ok ? ((await resp.json()) as { name?: string; icons?: unknown[] }) : null;
      const regs =
        'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistrations() : [];
      setDiag({
        status: resp.ok && Boolean(data?.name) ? 'ok' : 'error',
        hasLinkTag: Boolean(linkTag),
        manifestOk: Boolean(resp.ok && data?.name),
        swOk: regs.length > 0,
        manifestName: data?.name,
        iconCount: Array.isArray(data?.icons) ? data.icons.length : 0,
      });
    } catch (err) {
      setDiag({
        status: 'error',
        hasLinkTag: Boolean(document.querySelector('link[rel="manifest"]')),
        manifestOk: false,
        swOk: false,
        errorDetail: err instanceof Error ? err.message : 'Gagal memeriksa manifest',
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      setPwabuilderUrl(suggestedSharedUrl);
      void runDiagnostic();
    }
  }, [isOpen, suggestedSharedUrl]);

  if (!isOpen) return null;

  const targetIsPrivate =
    pwabuilderUrl.includes('ais-dev-') ||
    pwabuilderUrl.includes('localhost') ||
    pwabuilderUrl.includes('127.0.0.1');

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(pwabuilderUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setCopiedUrl(false);
    }
  };

  const handleInstallNow = async () => {
    const ok = await install();
    if (ok) {
      setDownloadMsg('Aplikasi berhasil dipasang ke layar utama perangkat!');
    }
  };

  const handleDownloadKit = async () => {
    setDownloadingKit(true);
    setDownloadMsg('');
    try {
      await downloadAndroidApkBuildKit(pwabuilderUrl || originUrl);
      setDownloadMsg(
        'File MelonFlow-NFT-Android-APK-Kit.zip berhasil diunduh (berisi manifest.webmanifest, manifest.json, twa-manifest.json, dan PANDUAN-BUILD-APK.txt).'
      );
    } finally {
      setDownloadingKit(false);
    }
  };

  const handleDownloadManifestJson = async () => {
    try {
      const resp = await fetch(`${basePath}manifest.webmanifest`, { cache: 'no-store' });
      const text = resp.ok ? await resp.text() : JSON.stringify({}, null, 2);
      const blob = new Blob([text], { type: 'application/manifest+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'manifest.json';
      a.click();
      URL.revokeObjectURL(url);
      setDownloadMsg('File manifest.json berhasil diunduh ke perangkat Anda.');
    } catch {
      setDownloadMsg('Gagal mengunduh file manifest.json.');
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Versi HP, Tablet & Android APK"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-3.5 sm:px-5 sm:py-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div className="min-w-0 pr-2">
            <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
              <Smartphone className="h-4 w-4 shrink-0" style={{ color: 'var(--app-accent)' }} />
              <span className="truncate">Aplikasi HP / Tablet & Paket Android APK</span>
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
              Pasang langsung di layar utama Android/iOS (mode offline) atau unduh paket proyek build APK.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog HP dan APK"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Status Badges */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <Smartphone className="h-5 w-5 shrink-0" style={{ color: 'var(--app-accent)' }} />
              <div>
                <div className="text-xs font-semibold">Tata Letak HP & Tablet Adaptif</div>
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Tabel menjadi kartu rapi di HP & grid penuh di tablet.
                </div>
              </div>
            </div>
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-canvas)',
              }}
            >
              <Tablet className="h-5 w-5 shrink-0" style={{ color: 'var(--app-accent)' }} />
              <div>
                <div className="text-xs font-semibold">
                  Status PWA: {isInstalled ? 'Terpasang di Perangkat' : 'Siap Diinstall (Offline)'}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  {diag.manifestOk
                    ? `Manifest aktif (${diag.iconCount || 0} ikon) & ${diag.swOk ? 'SW aktif' : 'SW siap'}.`
                    : 'Memeriksa file manifest PWA...'}
                </div>
              </div>
            </div>
          </div>

          {/* Live PWA & PWABuilder Diagnostic */}
          <div
            className="rounded-xl border p-3.5 space-y-2.5"
            style={{
              borderColor: isPrivateDevHost ? '#d97706' : 'var(--app-border)',
              backgroundColor: isPrivateDevHost ? 'rgba(245, 158, 11, 0.08)' : 'var(--app-canvas)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold">
                {diag.manifestOk ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                )}
                <span>Diagnostik Manifest & PWABuilder</span>
              </div>
              <button
                type="button"
                onClick={runDiagnostic}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium cursor-pointer"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}
              >
                <RefreshCw className={`h-3 w-3 ${diag.status === 'checking' ? 'animate-spin' : ''}`} />
                Cek Ulang
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <div
                className="rounded-lg border px-2.5 py-1.5 flex items-center justify-between"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}
              >
                <span>Tag &lt;link rel="manifest"&gt;</span>
                <span className={diag.hasLinkTag ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                  {diag.hasLinkTag ? 'Ada' : 'Tidak'}
                </span>
              </div>
              <div
                className="rounded-lg border px-2.5 py-1.5 flex items-center justify-between"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}
              >
                <span>/manifest.webmanifest</span>
                <span className={diag.manifestOk ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                  {diag.manifestOk ? 'Valid (200)' : 'Gagal'}
                </span>
              </div>
              <div
                className="rounded-lg border px-2.5 py-1.5 flex items-center justify-between"
                style={{ borderColor: 'var(--app-border)', backgroundColor: 'var(--app-surface)' }}
              >
                <span>Service Worker</span>
                <span className={diag.swOk ? 'font-bold text-emerald-600' : 'font-bold text-amber-600'}>
                  {diag.swOk ? 'Aktif' : 'Menunggu'}
                </span>
              </div>
            </div>

            {isPrivateDevHost && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                <strong>Kenapa PWABuilder memunculkan pesan "we didn&apos;t find a manifest before our tests timed out"?</strong>
                <br />
                Saat ini Anda membuka URL preview privat (<code>{hostname}</code>) yang terkunci di balik login Google AI Studio.
                Server eksternal <strong>PWABuilder</strong> tidak bisa login ke sesi Google Anda sehingga langsung <em>timeout</em> di gerbang login sebelum sempat membaca <code>manifest.webmanifest</code>!
                <br />
                <strong>Cara Memperbaiki:</strong> Klik <strong>Share / Publish</strong> di AI Studio agar menjadi URL publik (<code>https://ais-pre-...run.app</code> dengan akses publik, atau deploy ke Vercel/Netlify/Firebase Hosting), lalu uji URL publik tersebut di PWABuilder.
              </div>
            )}
          </div>

          {/* Option 1: Direct Install on Phone/Tablet (WebAPK / PWA) */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              borderColor: 'var(--app-accent)',
              backgroundColor: 'var(--app-accent-soft)',
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold" style={{ color: 'var(--app-accent)' }}>
                1. Install Langsung ke HP / Tablet Android (WebAPK — Tanpa PWABuilder)
              </div>
              {isInstalled && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Sudah Terpasang
                </span>
              )}
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text)' }}>
              Di HP & Tablet Android, Chrome otomatis membungkus aplikasi ini menjadi <strong>WebAPK</strong> menggunakan <code>manifest.webmanifest</code> bawaan (ikon muncul di layar utama dan berjalan layar penuh tanpa bilah browser).
            </p>

            {isInstallable && !isInstalled && (
              <button
                type="button"
                onClick={handleInstallNow}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <Download className="h-4 w-4" />
                Install Aplikasi ke Perangkat Sekarang
              </button>
            )}

            <div
              className="rounded-lg border p-3 space-y-1.5 text-xs"
              style={{
                borderColor: 'var(--app-border)',
                backgroundColor: 'var(--app-surface)',
              }}
            >
              {isIOS ? (
                <>
                  <div className="font-semibold">Panduan iPhone / iPad (Safari):</div>
                  <ol className="list-decimal pl-4 space-y-1" style={{ color: 'var(--app-text-muted)' }}>
                    <li>Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah/atas Safari.</li>
                    <li>Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.</li>
                    <li>Ketuk <strong>Tambah (Add)</strong> — ikon MelonFlow muncul seperti aplikasi native.</li>
                  </ol>
                </>
              ) : (
                <>
                  <div className="font-semibold">Panduan HP / Tablet Android (Chrome / Edge):</div>
                  <ol className="list-decimal pl-4 space-y-1" style={{ color: 'var(--app-text-muted)' }}>
                    <li>Buka link aplikasi ini di <strong>Google Chrome</strong> HP/Tablet Anda.</li>
                    <li>
                      Ketuk tombol <strong>Install Aplikasi Sekarang</strong> di atas (jika muncul), atau ketuk ikon titik tiga (<strong>⋮</strong>) di kanan atas Chrome.
                    </li>
                    <li>
                      Pilih <strong>Tambahkan ke layar utama</strong> → <strong>Install aplikasi</strong>. Aplikasi akan terpasang permanen dan bisa dibuka offline di kebun.
                    </li>
                  </ol>
                </>
              )}
            </div>
          </div>

          {/* Option 2: Download Android APK Build Kit (.zip) */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="flex items-center gap-2 text-sm font-bold">
              <FolderArchive className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
              <span>2. Build File .APK (PWABuilder URL Publik / Paket Offline)</span>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>
              Tempel <strong>URL Publik</strong> aplikasi (misalnya hasil Share Publik <code>ais-pre-...</code> atau domain Vercel/Netlify/Firebase Anda) sebelum membuka PWABuilder, atau unduh paket proyek & file <code>manifest.json</code> siap pakai di bawah ini.
            </p>

            {/* Editable Public URL bar */}
            <div
              className="flex flex-col gap-2 rounded-lg border p-2.5"
              style={{
                borderColor: targetIsPrivate ? '#d97706' : 'var(--app-border)',
                backgroundColor: 'var(--app-surface)',
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="pwabuilder-target-url"
                  className="text-[11px] font-semibold"
                  style={{ color: 'var(--app-text-muted)' }}
                >
                  URL Target untuk PWABuilder (Harus URL Publik tanpa login):
                </label>
                {targetIsPrivate && (
                  <span className="text-[10px] font-semibold text-amber-600">
                    URL Privat (Akan Timeout di PWABuilder)
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="pwabuilder-target-url"
                  type="url"
                  value={pwabuilderUrl}
                  onChange={(e) => setPwabuilderUrl(e.target.value)}
                  placeholder="https://nama-domain-publik-anda.app"
                  className="flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-mono-tabular outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-canvas)',
                    color: 'var(--app-text)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer shrink-0"
                  style={{ borderColor: 'var(--app-border)' }}
                >
                  {copiedUrl ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedUrl ? 'Tersalin!' : 'Salin Link'}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={downloadingKit}
                onClick={handleDownloadKit}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <Download className="h-4 w-4" />
                {downloadingKit ? 'Menyiapkan Paket...' : 'Unduh Paket Build APK (.zip)'}
              </button>

              <button
                type="button"
                onClick={handleDownloadManifestJson}
                className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-xs font-semibold cursor-pointer"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-text)',
                }}
              >
                <FileJson className="h-3.5 w-3.5" />
                Unduh manifest.json
              </button>

              <a
                href={`https://www.pwabuilder.com/reportcard?site=${encodeURIComponent(pwabuilderUrl.trim() || originUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-xs font-semibold cursor-pointer"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-surface)',
                  color: 'var(--app-text)',
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Uji di PWABuilder
              </a>
            </div>

            {downloadMsg && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs text-emerald-800 dark:text-emerald-200">
                {downloadMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
