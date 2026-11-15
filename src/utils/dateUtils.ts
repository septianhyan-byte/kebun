export function toLocalDateInputValue(input?: string | Date): string {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function toLocalDateTimeInputValue(input?: string | Date): string {
  const d = input ? new Date(input) : new Date();
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = safe.getFullYear();
  const m = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  const hh = String(safe.getHours()).padStart(2, '0');
  const mm = String(safe.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

export function localDateTimeInputToIso(val: string): string {
  if (!val) return new Date().toISOString();
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function localDateInputToIsoWithCurrentTime(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date().toISOString();
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const now = new Date();
  const combined = new Date(
    y,
    m - 1,
    d,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds()
  );
  if (Number.isNaN(combined.getTime())) return new Date().toISOString();
  return combined.toISOString();
}

export function matchesLocalDate(isoOrDate: string | undefined, selectedYmd: string): boolean {
  if (!selectedYmd) return true;
  if (!isoOrDate) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate === selectedYmd;
  }
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return false;
  return toLocalDateInputValue(d) === selectedYmd;
}

export function formatDateShortId(isoOrDate: string): string {
  if (!isoOrDate) return '-';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)
    ? new Date(`${isoOrDate}T00:00:00`)
    : new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) return isoOrDate;
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function diffLocalCalendarDays(
  fromInput: string | Date,
  toInput: string | Date
): number {
  const fromYmd =
    typeof fromInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fromInput)
      ? fromInput
      : toLocalDateInputValue(fromInput);
  const toYmd =
    typeof toInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(toInput)
      ? toInput
      : toLocalDateInputValue(toInput);
  const [fy, fm, fd] = fromYmd.split('-').map(Number);
  const [ty, tm, td] = toYmd.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return 0;
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86400000);
}
