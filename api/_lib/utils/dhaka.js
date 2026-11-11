// Bangladesh Standard Time is UTC+6 all year (no daylight saving), so day/month boundaries are exact offsets.
// Reports use these boundaries so "today" and "this month" mean the shop's own calendar, not UTC.
export const TZ = 'Asia/Dhaka';
const OFFSET_MS = 6 * 3600 * 1000;
const DAY_MS = 86400000;

export class BadRangeError extends Error {
  constructor(message) { super(message); this.name = 'BadRangeError'; }
}

export const dhakaDayStart = (d) => new Date(Math.floor((d.getTime() + OFFSET_MS) / DAY_MS) * DAY_MS - OFFSET_MS);
export const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
// Start of the Dhaka month that is `n` months after the month containing d.
export function addMonths(d, n) {
  const local = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + n, 1) - OFFSET_MS);
}
export const dhakaMonthStart = (d) => addMonths(d, 0);
export const dhakaDateString = (d) => new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
export const dhakaMonthString = (d) => dhakaDateString(d).slice(0, 7);

// 'YYYY-MM-DD' -> instant at which that Dhaka day starts; null if not a real calendar date.
export function parseDhakaDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d);
  const chk = new Date(t);
  if (chk.getUTCFullYear() !== y || chk.getUTCMonth() !== m - 1 || chk.getUTCDate() !== d) return null;
  return new Date(t - OFFSET_MS);
}

export const PRESETS = ['today', 'last7', 'last30', 'this_month', 'prev_month', 'custom', 'all'];
const MAX_CUSTOM_DAYS = 1830; // ~5 years

// Returns { preset, start, end } with start inclusive (null = unbounded) and end EXCLUSIVE.
export function resolveRange({ preset = 'last30', from, to } = {}, now = new Date()) {
  const today = dhakaDayStart(now);
  switch (preset) {
    case 'today': return { preset, start: today, end: addDays(today, 1) };
    case 'last7': return { preset, start: addDays(today, -6), end: addDays(today, 1) };
    case 'last30': return { preset, start: addDays(today, -29), end: addDays(today, 1) };
    case 'this_month': return { preset, start: dhakaMonthStart(now), end: addMonths(now, 1) };
    case 'prev_month': return { preset, start: addMonths(now, -1), end: dhakaMonthStart(now) };
    case 'all': return { preset, start: null, end: addDays(today, 1) };
    case 'custom': {
      const start = parseDhakaDate(from);
      const last = parseDhakaDate(to);
      if (!start || !last) throw new BadRangeError('Custom range needs valid from and to dates (YYYY-MM-DD)');
      if (last < start) throw new BadRangeError('"to" must not be before "from"');
      if ((last - start) / DAY_MS > MAX_CUSTOM_DAYS) throw new BadRangeError('Custom range is too long (max 5 years)');
      return { preset, start, end: addDays(last, 1) };
    }
    default: throw new BadRangeError('Unknown range preset');
  }
}

export const matchFor = (range, field = 'createdAt') => {
  const cond = { $lt: range.end };
  if (range.start) cond.$gte = range.start;
  return { [field]: cond };
};

export const rangeDays = (range) => (range.start ? Math.round((range.end - range.start) / DAY_MS) : Infinity);

// Every Dhaka calendar day in the range, as 'YYYY-MM-DD' (used to fill zero-sales days in charts).
export function eachDay(range) {
  const out = [];
  for (let d = range.start; d < range.end && out.length < 400; d = addDays(d, 1)) out.push(dhakaDateString(d));
  return out;
}
