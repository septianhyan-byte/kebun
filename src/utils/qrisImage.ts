/**
 * Mengompres gambar QRIS dari galeri menjadi data URL yang tajam, tetap terbaca scanner,
 * dan berukuran aman untuk penyimpanan lokal serta sinkronisasi Cloud Firestore.
 */
export async function compressQrisImageFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File yang dipilih harus berupa gambar (JPG, PNG, atau WebP).');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Gagal membaca gambar QRIS dari galeri.'));
      el.src = objectUrl;
    });

    const naturalW = img.naturalWidth || img.width || 480;
    const naturalH = img.naturalHeight || img.height || 480;

    const tryRender = (maxDim: number, mime: string, quality: number): string => {
      const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
      const w = Math.max(1, Math.round(naturalW * scale));
      const h = Math.max(1, Math.round(naturalH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Browser tidak mendukung pemrosesan gambar kanvas.');
      }
      // Latar putih agar QRIS transparan tetap tajam saat dicetak pada nota
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL(mime, quality);
    };

    const attempts: Array<[number, string, number]> = [
      [520, 'image/webp', 0.88],
      [480, 'image/jpeg', 0.88],
      [420, 'image/jpeg', 0.78],
      [360, 'image/jpeg', 0.7],
      [300, 'image/jpeg', 0.62],
    ];

    for (const [dim, mime, q] of attempts) {
      const dataUrl = tryRender(dim, mime, q);
      if (dataUrl.length <= 240_000) {
        return dataUrl;
      }
    }

    return tryRender(260, 'image/jpeg', 0.55);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
