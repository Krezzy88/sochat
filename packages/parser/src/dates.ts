import type { DateResolution } from './types.ts';

const VN_OFFSET_MS = 7 * 3600 * 1000;
const DAY_MS = 86400000;
const WEEKDAY: Readonly<Record<string, number>> = {
  hai: 1,
  ba: 2,
  tu: 3,
  nam: 4,
  sau: 5,
  bay: 6,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
};

function calendarDate(year: number, month: number, day: number): Date | null {
  if (year < 1 || year > 9999) return null;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function iso(date: Date): string {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return (
    !!match &&
    calendarDate(Number(match[1]), Number(match[2]), Number(match[3])) !== null
  );
}

/** Require an ISO instant with an explicit timezone; never consult the wall clock. */
export function localToday(nowIso: string): Date | null {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(
      nowIso,
    );
  if (!match?.[1] || !isCalendarDate(match[1])) return null;
  const time = Date.parse(nowIso);
  if (!Number.isFinite(time)) return null;
  const local = new Date(time + VN_OFFSET_MS);
  return calendarDate(
    local.getUTCFullYear(),
    local.getUTCMonth() + 1,
    local.getUTCDate(),
  );
}

function resolved(date: Date, explicit: boolean): DateResolution {
  const value = iso(date);
  return isCalendarDate(value)
    ? { date: value, explicit, flags: [] }
    : { date: null, explicit: true, flags: ['invalid_date'] };
}

export function resolveDate(
  foldedText: string,
  nowIso: string,
): DateResolution {
  const today = localToday(nowIso);
  if (!today) return { date: null, explicit: false, flags: ['invalid_now'] };
  const invalid: DateResolution = {
    date: null,
    explicit: true,
    flags: ['invalid_date'],
  };
  // Inspect explicit dates first: invalid dates must not be hidden by "hôm nay".
  const numeric = /\b(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?\b/.exec(
    foldedText,
  );
  const words =
    /\bngay\s+(\d{1,2})\s+thang\s+(\d{1,2})(?:\s+nam\s+(\d{4}))?\b/.exec(
      foldedText,
    );
  const match = numeric ?? words;
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const rawYear = match[3];
    const year = rawYear
      ? rawYear.length === 2
        ? 2000 + Number(rawYear)
        : Number(rawYear)
      : today.getUTCFullYear();
    let date = calendarDate(year, month, day);
    if (!date) return invalid;
    if (!rawYear && date > today) date = calendarDate(year - 1, month, day);
    return date ? resolved(date, true) : invalid;
  }
  const addDays = (date: Date, days: number): Date =>
    new Date(date.getTime() + days * DAY_MS);
  if (/\bhom kia\b/.test(foldedText)) return resolved(addDays(today, -2), true);
  if (/\b(hom qua|toi qua|sang qua|trua qua|chieu qua)\b/.test(foldedText))
    return resolved(addDays(today, -1), true);
  if (/\b(hom nay|sang nay|trua nay|chieu nay|toi nay)\b/.test(foldedText))
    return resolved(today, true);

  const weekday =
    /\b(?:thu\s+(hai|ba|tu|nam|sau|bay|[2-7])|(chu nhat))(\s+tuan truoc)?\b/.exec(
      foldedText,
    );
  if (weekday) {
    const day = weekday[2] ? 0 : WEEKDAY[weekday[1] ?? ''];
    if (day !== undefined) {
      if (weekday[3]) {
        const monday = addDays(today, -((today.getUTCDay() + 6) % 7) - 7);
        return resolved(addDays(monday, (day + 6) % 7), true);
      }
      return resolved(
        addDays(today, -((today.getUTCDay() - day + 7) % 7)),
        true,
      );
    }
  }
  return resolved(today, false);
}
