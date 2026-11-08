import type { Item, ItemType } from "./types";

export const TZ = "Asia/Jerusalem";
const DAY = 86_400_000;

/** Today's date in Israel, YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUTC(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysUntil(date: string, today: string): number {
  return Math.round((toUTC(date) - toUTC(today)) / DAY);
}

export function addDays(date: string, n: number): string {
  return new Date(toUTC(date) + n * DAY).toISOString().slice(0, 10);
}

/** "יום א׳, 8 בנוב׳" (+ year when it isn't the current year). */
export function formatDate(date: string, today: string = todayISO()): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4);
  return new Date(toUTC(date)).toLocaleDateString("he-IL", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatShortDate(date: string): string {
  return new Date(toUTC(date)).toLocaleDateString("he-IL", { timeZone: "UTC", day: "numeric", month: "short" });
}

/** Number and unit shown on the stub of a card. */
export function countdown(n: number): { num: string; label: string } {
  if (n === 0) return { num: "0", label: "היום" };
  if (n === 1) return { num: "1", label: "יום" };
  if (n === 2) return { num: "2", label: "ימים" };
  if (n <= 60) return { num: String(n), label: "ימים" };
  return { num: String(Math.round(n / 30)), label: "חודשים" };
}

export const REMINDER_OFFSETS: Record<ItemType, number[]> = {
  ticket: [7, 1],
  coupon: [30, 7, 1],
};

export function offsetLabel(offset: number): string {
  return offset === 30 ? "חודש לפני" : offset === 7 ? "שבוע לפני" : offset === 1 ? "יום לפני" : `${offset} ימים לפני`;
}

export interface PlannedReminder {
  offset: number;
  label: string;
  sendDate: string;
  /** The send date has already passed (or is today). */
  done: boolean;
}

export function reminderPlan(item: Pick<Item, "type" | "date">, today: string): PlannedReminder[] {
  return REMINDER_OFFSETS[item.type].map((offset) => {
    const sendDate = addDays(item.date, -offset);
    return { offset, label: offsetLabel(offset), sendDate, done: sendDate <= today };
  });
}

export type HistoryReason = "used" | "expired" | "passed";

export function historyReason(item: Pick<Item, "type" | "date" | "usedUp">, today: string): HistoryReason | null {
  if (item.usedUp) return "used";
  if (item.date < today) return item.type === "ticket" ? "passed" : "expired";
  return null;
}

export function isHistory(item: Pick<Item, "type" | "date" | "usedUp">, today: string): boolean {
  return historyReason(item, today) !== null;
}
