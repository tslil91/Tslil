import type { Item, ItemType, Usage } from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function blankItem(type: ItemType, createdBy: string): Item {
  const now = new Date().toISOString();
  return {
    id: newId(), type, title: "", place: "", date: "", time: type === "ticket" ? "20:00" : null,
    value: null, remaining: null, notes: "", attachments: [], usages: [], usedUp: false,
    createdBy, createdAt: now, updatedAt: now,
  };
}

const sum = (u: Usage[]) => u.reduce((s, x) => s + x.amount, 0);

/** Record that part of a coupon's balance was used. Using the whole balance marks it as used up. */
export function applyUsage(item: Item, amount: number, by: string, at = new Date()): Item {
  if (item.value == null || item.remaining == null) throw new Error("לשובר הזה אין שווי בשקלים");
  if (!(amount > 0)) throw new Error("הסכום צריך להיות גדול מאפס");
  const used = Math.min(amount, item.remaining);
  const remaining = round2(item.remaining - used);
  return {
    ...item,
    remaining,
    usedUp: remaining <= 0,
    usages: [...item.usages, { id: newId(), amount: used, at: at.toISOString(), by }],
  };
}

export function markFullyUsed(item: Item, by: string, at = new Date()): Item {
  if (item.value != null && item.remaining != null && item.remaining > 0) return applyUsage(item, item.remaining, by, at);
  return { ...item, usedUp: true };
}

/** Undo one usage entry (entered by mistake). */
export function removeUsage(item: Item, usageId: string): Item {
  const usages = item.usages.filter((u) => u.id !== usageId);
  const remaining = item.value == null ? null : round2(Math.max(0, item.value - sum(usages)));
  return { ...item, usages, remaining, usedUp: remaining == null ? item.usedUp && usages.length > 0 : remaining <= 0 };
}

/** Move an item out of History back to the wallet. A coupon used up by its last usage gets that usage back. */
export function restore(item: Item): Item {
  if (item.value != null && (item.remaining ?? 0) <= 0 && item.usages.length) {
    return removeUsage(item, item.usages[item.usages.length - 1].id);
  }
  return { ...item, usedUp: false };
}

/** Keep the balance consistent when the coupon value is edited. */
export function withValue(item: Item, value: number | null): Item {
  if (value == null) return { ...item, value: null, remaining: null };
  const remaining = round2(Math.max(0, value - sum(item.usages)));
  return { ...item, value, remaining, usedUp: item.usages.length > 0 && remaining <= 0 ? true : item.usedUp && remaining <= 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatILS(n: number): string {
  return "₪" + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}
