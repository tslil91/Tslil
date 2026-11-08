import { describe, expect, it } from "vitest";
import { addDays, countdown, daysUntil, historyReason, reminderPlan, todayISO } from "./dates";
import { applyUsage, blankItem, markFullyUsed, removeUsage, restore, withValue } from "./items";
import type { Item } from "./types";

const coupon = (over: Partial<Item> = {}): Item => ({
  ...blankItem("coupon", "me"), title: "Gift card", date: "2026-12-01", value: 300, remaining: 300, ...over,
});

describe("dates", () => {
  it("uses Israel time for today", () => {
    // 23:30 UTC on 8 Nov is already 9 Nov in Israel (UTC+2 in winter)
    expect(todayISO(new Date("2026-11-08T23:30:00Z"))).toBe("2026-11-09");
    expect(todayISO(new Date("2026-11-08T20:00:00Z"))).toBe("2026-11-08");
  });
  it("counts days across a DST change", () => {
    expect(daysUntil("2026-10-26", "2026-10-24")).toBe(2); // Israel DST ends 25 Oct 2026
    expect(daysUntil("2026-11-07", "2026-11-08")).toBe(-1);
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("labels countdowns in Hebrew", () => {
    expect(countdown(0).label).toBe("היום");
    expect(countdown(1)).toEqual({ num: "1", label: "יום" });
    expect(countdown(90)).toEqual({ num: "3", label: "חודשים" });
  });
  it("plans 7/1 day reminders for tickets and 30/7/1 for coupons", () => {
    const t = reminderPlan({ type: "ticket", date: "2026-11-14" }, "2026-11-08");
    expect(t.map((r) => [r.sendDate, r.done])).toEqual([["2026-11-07", true], ["2026-11-13", false]]);
    const c = reminderPlan({ type: "coupon", date: "2026-12-31" }, "2026-11-08");
    expect(c.map((r) => r.sendDate)).toEqual(["2026-12-01", "2026-12-24", "2026-12-30"]);
  });
  it("moves items to history when used, expired or passed", () => {
    expect(historyReason({ type: "coupon", date: "2026-11-08", usedUp: false }, "2026-11-08")).toBeNull(); // valid through its last day
    expect(historyReason({ type: "coupon", date: "2026-11-07", usedUp: false }, "2026-11-08")).toBe("expired");
    expect(historyReason({ type: "ticket", date: "2026-11-07", usedUp: false }, "2026-11-08")).toBe("passed");
    expect(historyReason({ type: "coupon", date: "2027-01-01", usedUp: true }, "2026-11-08")).toBe("used");
  });
});

describe("coupon usage", () => {
  it("tracks partial use and balance", () => {
    const a = applyUsage(coupon(), 120, "me");
    expect(a.remaining).toBe(180);
    expect(a.usedUp).toBe(false);
    const b = applyUsage(a, 500, "her"); // cannot use more than the balance
    expect(b.remaining).toBe(0);
    expect(b.usedUp).toBe(true);
    expect(b.usages.map((u) => u.amount)).toEqual([120, 180]);
  });
  it("undoes a usage entered by mistake", () => {
    const a = applyUsage(applyUsage(coupon(), 100, "me"), 200, "me");
    expect(a.usedUp).toBe(true);
    const b = removeUsage(a, a.usages[1].id);
    expect(b.remaining).toBe(200);
    expect(b.usedUp).toBe(false);
  });
  it("marks fully used and restores", () => {
    const a = markFullyUsed(applyUsage(coupon(), 50, "me"), "me");
    expect(a.remaining).toBe(0);
    const r = restore(a);
    expect(r.usedUp).toBe(false);
    expect(r.remaining).toBe(250);
    const pct = markFullyUsed(coupon({ value: null, remaining: null }), "me");
    expect(pct.usedUp).toBe(true);
    expect(restore(pct).usedUp).toBe(false);
  });
  it("recalculates balance when the value is edited", () => {
    const a = applyUsage(coupon(), 100, "me");
    expect(withValue(a, 500).remaining).toBe(400);
    expect(withValue(a, 80)).toMatchObject({ remaining: 0, usedUp: true });
    expect(withValue(a, null)).toMatchObject({ value: null, remaining: null });
  });
});
