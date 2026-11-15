// Pure TypeScript minimal ZIP archive generator (Store mode) for Android APK Build Kit

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntryInput {
  name: string;
  content: Uint8Array;
}

function buildZipBlob(entries: ZipEntryInput[]): Blob {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.content;
    const crc = crc32(data);

    // Local file header (30 bytes + filename)
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // Store (no compression)
    lv.setUint16(10, 0, true);
    lv.setUint16(12, 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    localParts.push(local, data);

    // Central directory header (46 bytes + filename)
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    centralParts.push(central);
    offset += local.length + data.length;
  }

  let centralSize = 0;
  for (const c of centralParts) centralSize += c.length;

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const blobParts: BlobPart[] = [
    ...localParts.map((u) => new Uint8Array(u)),
    ...centralParts.map((u) => new Uint8Array(u)),
    new Uint8Array(eocd),
  ];

  return new Blob(blobParts, { type: 'application/zip' });
}

export async function downloadAndroidApkBuildKit(appOrigin: string): Promise<void> {
  const encoder = new TextEncoder();
  const cleanOrigin = appOrigin.replace(/\/+$/, '');
  let hostname = 'melonflow.local';
  let startPath = '/';
  try {
    const parsedUrl = new URL(cleanOrigin);
    hostname = parsedUrl.hostname;
    const rawPath = parsedUrl.pathname || '/';
    startPath = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
  } catch {
    hostname = 'melonflow.local';
    startPath = '/';
  }

  const capacitorConfig = {
    appId: 'id.melonflow.nft',
    appName: 'MelonFlow NFT',
    webDir: 'dist',
    server: {
      url: cleanOrigin,
      cleartext: cleanOrigin.startsWith('http://'),
    },
    android: {
      allowMixedContent: true,
    },
  };

  const twaManifest = {
    packageId: 'id.melonflow.nft',
    host: hostname,
    name: 'MelonFlow NFT — Kontrol Hidroponik',
    launcherName: 'MelonFlow',
    display: 'standalone',
    themeColor: '#15803d',
    navigationColor: '#15803d',
    backgroundColor: '#f7f9f7',
    startUrl: startPath,
    iconUrl: `${cleanOrigin}/pwa-512x512.png`,
    maskableIconUrl: `${cleanOrigin}/pwa-maskable-512x512.png`,
    webManifestUrl: `${cleanOrigin}/manifest.webmanifest`,
    enableNotifications: true,
    fallbackType: 'customtabs',
    appVersionName: '1.0.0',
    appVersionCode: 1,
  };

  const pkgJson = {
    name: 'melonflow-nft-android-wrapper',
    version: '1.0.0',
    private: true,
    scripts: {
      'init:android': 'npx cap add android',
      'sync:android': 'npx cap sync android',
      'build:twa': 'npx @bubblewrap/cli build',
    },
    dependencies: {
      '@capacitor/android': '^7.0.0',
      '@capacitor/core': '^7.0.0',
    },
    devDependencies: {
      '@capacitor/cli': '^7.0.0',
      '@bubblewrap/cli': '^1.22.0',
    },
  };

  const webManifest = {
    id: startPath,
    name: 'MelonFlow NFT — Kontrol Melon Hidroponik',
    short_name: 'MelonFlow',
    description:
      'Aplikasi kontrol budidaya melon hidroponik sistem NFT: PPM & pH air, perawatan obat, serta pemetaan kondisi 1–1000 tanaman.',
    lang: 'id',
    dir: 'ltr',
    start_url: startPath,
    scope: startPath,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    theme_color: '#15803d',
    background_color: '#f7f9f7',
    prefer_related_applications: false,
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: `${cleanOrigin}/pwa-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${cleanOrigin}/pwa-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${cleanOrigin}/pwa-maskable-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  const guideText = `PANDUAN PEMBUATAN FILE APK ANDROID — MELONFLOW NFT
=====================================================

URL Aplikasi Saat Ini:
${cleanOrigin}

PENTING JIKA MUNCUL PESAN ERROR DI PWABUILDER:
"We didn't find a manifest on your site before our tests timed out"
-> Penyebab utama: Anda memasukkan URL preview privat ("ais-dev-...") atau "localhost".
   Server PWABuilder tidak memiliki akun login Google Anda sehingga diblokir di halaman login
   dan tes-nya kehabisan waktu (timeout) sebelum melihat file manifest.
-> Solusi:
   1. Di Google AI Studio klik tombol "Share App" (jadikan Publik), lalu salin Shared URL
      ("https://ais-pre-....run.app"), ATAU deploy build production ke hosting publik
      (Vercel / Netlify / Cloudflare Pages / Firebase Hosting).
   2. Tempel URL publik tersebut di PWABuilder, bukan URL "ais-dev-...".

1. Cara Tercepat di HP/Tablet Android (Tanpa PC / Tanpa PWABuilder):
   Buka URL aplikasi lewat Google Chrome di HP/Tablet Android Anda, lalu ketuk
   tombol "Install Aplikasi Sekarang" di aplikasi (atau menu Chrome >
   "Tambahkan ke layar utama" / "Install aplikasi"). Aplikasi akan langsung
   terpasang sebagai WebAPK di layar utama Android dengan ikon & mode offline!

2. Cara Membuat File Biner .APK (Untuk dibagikan via WhatsApp / file manager):
   METODE A — PWABuilder (Paling Mudah, Tanpa Android Studio):
   1. Pastikan Anda memakai URL PUBLIK (bukan ais-dev-... atau localhost).
   2. Kunjungi https://www.pwabuilder.com di browser komputer Anda.
   3. Tempel URL publik aplikasi Anda -> klik "Start".
   4. Pilih "Package for Stores" -> pilih "Android" -> unduh file .APK.

   METODE B — Bubblewrap TWA CLI (Memakai twa-manifest.json di paket ini):
   1. Pastikan Node.js dan Java JDK 17 + Android SDK terpasang di komputer.
   2. Ekstrak folder ZIP ini dan jalankan:
      npx @bubblewrap/cli build
   3. File "app-release-signed.apk" akan terbentuk di folder proyek.

   METODE C — Capacitor + Android Studio (Memakai capacitor.config.json di paket ini):
   1. Jalankan: npm install && npx cap add android
   2. Jalankan: npx cap open android
   3. Di Android Studio pilih menu: Build > Build Bundle(s) / APK(s) > Build APK(s).
`;

  const manifestStr = JSON.stringify(webManifest, null, 2);
  const entries: ZipEntryInput[] = [
    { name: 'PANDUAN-BUILD-APK.txt', content: encoder.encode(guideText) },
    { name: 'manifest.webmanifest', content: encoder.encode(manifestStr) },
    { name: 'manifest.json', content: encoder.encode(manifestStr) },
    { name: 'capacitor.config.json', content: encoder.encode(JSON.stringify(capacitorConfig, null, 2)) },
    { name: 'twa-manifest.json', content: encoder.encode(JSON.stringify(twaManifest, null, 2)) },
    { name: 'package.json', content: encoder.encode(JSON.stringify(pkgJson, null, 2)) },
  ];

  // Fetch PNG icon if available so package includes app icon asset
  try {
    const base = import.meta.env.BASE_URL || '/';
    const iconResp = await fetch(`${base}pwa-512x512.png`);
    if (iconResp.ok) {
      const iconBuf = new Uint8Array(await iconResp.arrayBuffer());
      entries.push({ name: 'assets/icon-512x512.png', content: iconBuf });
    }
  } catch {
    // Ignore if offline or icon fetch fails
  }

  const blob = buildZipBlob(entries);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'MelonFlow-NFT-Android-APK-Kit.zip';
  a.click();
  URL.revokeObjectURL(url);
}
