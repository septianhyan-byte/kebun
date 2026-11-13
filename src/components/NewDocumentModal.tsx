import React, { useState } from 'react';
import { Download, FilePlus2, FolderOpen, Trash2, Upload, X } from 'lucide-react';
import { SeasonDocument } from '../types';

interface NewDocumentModalProps {
  isOpen: boolean;
  documents: SeasonDocument[];
  activeDocId: string;
  onCreateNewDocument: (payload: {
    title: string;
    notes: string;
    keepGhStructure: boolean;
    ghCount: number;
  }) => void;
  onSelectDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onDeleteSelectedDocuments: (docIds: string[]) => void;
  onDeleteAllArchivedDocuments: () => void;
  onImportDocument: (doc: SeasonDocument) => void;
  onClose: () => void;
}

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({
  isOpen,
  documents,
  activeDocId,
  onCreateNewDocument,
  onSelectDocument,
  onDeleteDocument,
  onDeleteSelectedDocuments,
  onDeleteAllArchivedDocuments,
  onImportDocument,
  onClose,
}) => {
  const [title, setTitle] = useState(`Musim Tanam ${documents.length + 1} — ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
  const [notes, setNotes] = useState('');
  const [keepGhStructure, setKeepGhStructure] = useState(true);
  const [ghCount, setGhCount] = useState('3');
  const [importError, setImportError] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [confirmClearAllDocs, setConfirmClearAllDocs] = useState(false);

  if (!isOpen) return null;

  const deletableDocs = documents.filter((d) => d.id !== activeDocId);
  const allDeletableSelected =
    deletableDocs.length > 0 && deletableDocs.every((d) => selectedDocIds.includes(d.id));

  const toggleSelectDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const toggleSelectAllDocs = () => {
    if (allDeletableSelected) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(deletableDocs.map((d) => d.id));
    }
  };

  const handleDeleteSelected = () => {
    if (selectedDocIds.length === 0) return;
    onDeleteSelectedDocuments(selectedDocIds);
    setSelectedDocIds([]);
  };

  const handleDeleteAll = () => {
    onDeleteAllArchivedDocuments();
    setSelectedDocIds([]);
    setConfirmClearAllDocs(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateNewDocument({
      title: title.trim() || `Musim Tanam ${documents.length + 1}`,
      notes: notes.trim(),
      keepGhStructure,
      ghCount: Math.max(1, Math.min(12, parseInt(ghCount, 10) || 1)),
    });
    setNotes('');
    onClose();
  };

  const handleExportJson = (doc: SeasonDocument) => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^a-zA-Z0-9_-]+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError('');
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SeasonDocument;
      if (!parsed.title || !Array.isArray(parsed.greenhouses) || parsed.greenhouses.length === 0) {
        setImportError('Format file JSON tidak sesuai struktur dokumen MelonFlow.');
        return;
      }
      onImportDocument({
        ...parsed,
        id: `season-${Date.now()}`,
        updatedAt: new Date().toISOString(),
      });
      onClose();
    } catch {
      setImportError('Gagal membaca file JSON. Pastikan file cadangan valid.');
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Dokumen Musim Tanam Baru"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border shadow-xl"
        style={{
          backgroundColor: 'var(--app-surface)',
          borderColor: 'var(--app-border)',
          color: 'var(--app-text)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-5 py-4"
          style={{ borderColor: 'var(--app-border)' }}
        >
          <div>
            <h2 className="text-base font-bold">New Document — Manajemen Musim Tanam</h2>
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
              Buat dokumen baru setiap pergantian musim tanam tanpa menghapus arsip musim sebelumnya.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border cursor-pointer"
            style={{ borderColor: 'var(--app-border)' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Create New Season Form */}
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border p-4 space-y-3.5"
            style={{
              borderColor: 'var(--app-border)',
              backgroundColor: 'var(--app-canvas)',
            }}
          >
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FilePlus2 className="h-4 w-4" style={{ color: 'var(--app-accent)' }} />
              <span>Buat Dokumen Musim Tanam Baru</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">Nama Dokumen / Musim Tanam</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Mis. Musim Tanam 2 — Maret 2027"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Catatan Musim / Varietas Utama</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Mis. Uji coba Inthanon & Golden Apollo"
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
                  style={{
                    borderColor: 'var(--app-border)',
                    backgroundColor: 'var(--app-surface)',
                    color: 'var(--app-text)',
                  }}
                />
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="ghInitMode"
                  checked={keepGhStructure}
                  onChange={() => setKeepGhStructure(true)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span>
                  <strong>Salin daftar GH saat ini</strong> — Pertahankan GH 1, GH 2, dst., lalu reset log air, jadwal perawatan, dan status tanaman 1–1000 menjadi segar (Fase Semai).
                </span>
              </label>

              <label className="flex items-start gap-2.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="ghInitMode"
                  checked={!keepGhStructure}
                  onChange={() => setKeepGhStructure(false)}
                  className="mt-0.5 accent-emerald-600"
                />
                <span className="flex flex-wrap items-center gap-2">
                  <span>
                    <strong>Buat struktur GH baru</strong> dengan jumlah:
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    disabled={keepGhStructure}
                    value={ghCount}
                    onChange={(e) => setGhCount(e.target.value)}
                    className="w-16 rounded border px-2 py-0.5 font-mono-tabular text-xs disabled:opacity-50"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                      color: 'var(--app-text)',
                    }}
                  />
                  <span>Greenhouse (kapasitas 1–1000 per GH, dapat diisi manual).</span>
                </span>
              </label>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer"
                style={{
                  backgroundColor: 'var(--app-accent)',
                  color: 'var(--app-accent-fg)',
                }}
              >
                <FilePlus2 className="h-4 w-4" />
                Buat & Aktifkan Musim Baru
              </button>
            </div>
          </form>

          {/* Saved Documents Archive */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Arsip Dokumen Musim Tanam ({documents.length})</div>
              <label
                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer hover:opacity-85"
                style={{ borderColor: 'var(--app-border)' }}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Impor Backup (.json)</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleFileImport}
                  className="hidden"
                />
              </label>
            </div>

            {importError && (
              <p className="text-xs text-rose-600">{importError}</p>
            )}

            {deletableDocs.length > 0 && (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                style={{
                  borderColor: 'var(--app-border)',
                  backgroundColor: 'var(--app-canvas)',
                }}
              >
                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allDeletableSelected}
                    onChange={toggleSelectAllDocs}
                    className="h-4 w-4 rounded accent-emerald-600 cursor-pointer"
                  />
                  <span>
                    Pilih Semua Arsip ({deletableDocs.length})
                    {selectedDocIds.length > 0 && ` · ${selectedDocIds.length} dipilih`}
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={selectedDocIds.length === 0}
                    onClick={handleDeleteSelected}
                    className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold text-rose-600 transition-opacity disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                    style={{
                      borderColor: 'var(--app-border)',
                      backgroundColor: 'var(--app-surface)',
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus Dipilih ({selectedDocIds.length})
                  </button>

                  {!confirmClearAllDocs ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClearAllDocs(true)}
                      className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold text-rose-600 cursor-pointer whitespace-nowrap"
                      style={{
                        borderColor: 'var(--app-border)',
                        backgroundColor: 'var(--app-surface)',
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus Semua
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-rose-600">
                        Hapus semua arsip non-aktif?
                      </span>
                      <button
                        type="button"
                        onClick={handleDeleteAll}
                        className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
                      >
                        Ya, Hapus Semua
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearAllDocs(false)}
                        className="rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer whitespace-nowrap"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                        }}
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div
              className="divide-y rounded-xl border"
              style={{ borderColor: 'var(--app-border)' }}
            >
              {documents.map((doc) => {
                const isActive = doc.id === activeDocId;
                const isSelected = selectedDocIds.includes(doc.id);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      backgroundColor: isSelected
                        ? 'rgba(225, 29, 72, 0.08)'
                        : isActive
                        ? 'var(--app-accent-soft)'
                        : 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {!isActive ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectDoc(doc.id)}
                          aria-label={`Pilih dokumen ${doc.title}`}
                          className="mt-0.5 h-4 w-4 rounded accent-emerald-600 cursor-pointer shrink-0"
                        />
                      ) : (
                        <span className="mt-0.5 h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate">{doc.title}</span>
                          {isActive && (
                            <span className="text-[11px] font-semibold" style={{ color: 'var(--app-accent)' }}>
                              (Aktif)
                            </span>
                          )}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                          {doc.greenhouses.length} Greenhouse · Dibuat{' '}
                          {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                          {doc.notes ? ` · ${doc.notes}` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDocument(doc.id);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                          style={{
                            borderColor: 'var(--app-border)',
                            backgroundColor: 'var(--app-surface)',
                          }}
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          Buka
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleExportJson(doc)}
                        title="Ekspor JSON"
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                        style={{
                          borderColor: 'var(--app-border)',
                          backgroundColor: 'var(--app-surface)',
                        }}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Ekspor
                      </button>
                      {documents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteDocument(doc.id);
                            setSelectedDocIds((prev) => prev.filter((id) => id !== doc.id));
                          }}
                          title="Hapus dokumen"
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:text-rose-600 cursor-pointer whitespace-nowrap"
                          style={{
                            borderColor: 'var(--app-border)',
                            backgroundColor: 'var(--app-surface)',
                            color: 'var(--app-text-muted)',
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
