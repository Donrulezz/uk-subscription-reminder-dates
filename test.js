// node test.js  — checks the UK subscription engine against the worked examples in
// the worked examples below (computed from DMCCA s.258, s.259, s.265, s.261, SCRs reg 33).
const assert = require("assert");
const U = require("./uk-subs.js");
let pass = 0;
function t(name, fn) { fn(); pass++; console.log("PASS " + name); }
const base = { windowMin: 7, windowMax: 14, extraLeadDays: 30, noticeDays: 0, trial: "none" };
const run = (o) => { const r = U.schedule(Object.assign({}, base, o)); assert.deepStrictEqual(r.errors, []); return r; };
const dates = (r) => r.reminders.filter((x) => x.reason && !x.safety).map((x) => x.renewal);
const safetyDates = (r) => r.reminders.filter((x) => x.safety).map((x) => x.renewal);

t("monthly from 15 Jan 2027: every 6th payment, no extra, no renewal cooling-off", () => {
  const r = run({ entry: "2027-01-15", cycle: "monthly" });
  assert.deepStrictEqual(dates(r).slice(0, 4), ["2027-07-15", "2028-01-15", "2028-07-15", "2029-01-15"]);
  assert.ok(r.reminders.every((x) => !x.extra && !x.coolingOff));
});
t("guidance §4.4.1 example: monthly from 1 June -> reminder for 1 December, then the next 1 June", () => {
  assert.deepStrictEqual(dates(run({ entry: "2027-06-01", cycle: "monthly" })).slice(0, 2), ["2027-12-01", "2028-06-01"]);
});
t("send window = 7 to 14 days before the last day to cancel (day before renewal)", () => {
  const rem = run({ entry: "2027-01-15", cycle: "monthly" }).reminders[0];
  assert.strictEqual(rem.lastCancel, "2027-07-14");
  assert.strictEqual(rem.sendFrom, "2027-06-30");
  assert.strictEqual(rem.sendTo, "2027-07-07");
});
t("a notice period moves the last day to cancel earlier", () => {
  const rem = run({ entry: "2027-01-15", cycle: "monthly", noticeDays: 30 }).reminders[0];
  assert.strictEqual(rem.lastCancel, "2027-06-14");
});
t("annual from 1 Jan 2027: reminder + extra earlier reminder + renewal cooling-off 1-15 Jan 2028", () => {
  const r = run({ entry: "2027-01-01", cycle: "annual" });
  const rem = r.reminders[0];
  assert.strictEqual(rem.renewal, "2028-01-01");
  assert.ok(rem.extra, "extra reminder");
  assert.strictEqual(rem.extra.suggested, "2027-12-02");
  assert.strictEqual(rem.extra.ok, true);
  assert.deepStrictEqual([rem.coolingOff.from, rem.coolingOff.to], ["2028-01-01", "2028-01-15"]);
});
t("free first month from 10 Mar 2027: reminder for 10 Apr, cooling-off 10-24 Apr, then 6-monthly", () => {
  const r = run({ entry: "2027-03-10", cycle: "monthly", trial: "free:1m" });
  assert.deepStrictEqual(dates(r).slice(0, 3), ["2027-04-10", "2027-10-10", "2028-04-10"]);
  const first = r.reminders[0];
  assert.deepStrictEqual([first.coolingOff.from, first.coolingOff.to], ["2027-04-10", "2027-04-24"]);
  assert.ok(!r.reminders[1].coolingOff);
});
t("free 14-day trial: first payment on day 14 after sign-up", () => {
  const r = run({ entry: "2027-02-01", cycle: "monthly", trial: "free:14d" });
  assert.strictEqual(dates(r)[0], "2027-02-15");
});
t("reg 33: same intro price for 3 payments, then higher: remind for the 4th (1 May 2027)", () => {
  const r = run({ entry: "2027-02-01", cycle: "monthly", trial: "intro:3" });
  assert.deepStrictEqual(dates(r).slice(0, 3), ["2027-05-01", "2027-11-01", "2028-05-01"]);
  const may = r.reminders.filter((x) => x.renewal === "2027-05-01")[0];
  assert.deepStrictEqual([may.coolingOff.from, may.coolingOff.to], ["2027-05-01", "2027-05-15"]);
  assert.ok(!r.reminders.some((x) => x.renewal === "2027-03-01" || x.renewal === "2027-04-01"));
});
t("intro price on the first payment only: remind for the first renewal (s.258(3)(a))", () => {
  const r = run({ entry: "2027-02-01", cycle: "monthly", trial: "intro:1" });
  assert.strictEqual(dates(r)[0], "2027-03-01");
});
t("quarterly from 1 Jan 2027: every 2nd payment", () => {
  assert.deepStrictEqual(dates(run({ entry: "2027-01-01", cycle: "quarterly" })).slice(0, 2), ["2027-07-01", "2028-01-01"]);
});
t("4-monthly from 1 Jan 2027: every payment", () => {
  assert.deepStrictEqual(dates(run({ entry: "2027-01-01", cycle: "4 months" })).slice(0, 3), ["2027-05-01", "2027-09-01", "2028-01-01"]);
});
t("weekly from 4 Jan 2027: 28 Jun 2027, then 27 Dec 2027", () => {
  assert.deepStrictEqual(dates(run({ entry: "2027-01-04", cycle: "weekly" })).slice(0, 2), ["2027-06-28", "2027-12-27"]);
});
t("weekly: the payment one day after the period end (5 Jul) gets a safety reminder, marked as such", () => {
  const r = run({ entry: "2027-01-04", cycle: "weekly" });
  assert.strictEqual(safetyDates(r)[0], "2027-07-05");
  assert.ok(r.events.some((e) => e.kind === "safety-reminder" && e.renewal === "2027-07-05"));
});
t("monthly on the same day number: both readings agree, no safety reminders", () => {
  assert.deepStrictEqual(safetyDates(run({ entry: "2027-01-15", cycle: "monthly" })), []);
});
t("9-monthly: every payment, no extra reminder, no renewal cooling-off", () => {
  const r = run({ entry: "2027-01-01", cycle: "9 months" });
  assert.deepStrictEqual(dates(r).slice(0, 2), ["2027-10-01", "2028-07-01"]);
  assert.ok(r.reminders.every((x) => !x.extra && !x.coolingOff));
});
t("3-year annual contract ending 31 Dec 2029: extra reminder on the last renewal too (s.259(7)(b))", () => {
  const r = run({ entry: "2027-01-01", cycle: "annual", fixedEnd: "2029-12-31" });
  assert.deepStrictEqual(dates(r), ["2028-01-01", "2029-01-01"]);
  assert.ok(r.reminders.every((x) => x.extra && x.coolingOff));
  assert.strictEqual(r.reminders[1].nextPayment, null);
});
t("month-end start (31 Jan) keeps the 6-month periods aligned", () => {
  assert.deepStrictEqual(dates(run({ entry: "2027-01-31", cycle: "monthly" })).slice(0, 2), ["2027-07-31", "2028-01-31"]);
});
t("initial cooling-off: 14 days from the contract, or from the goods arriving", () => {
  assert.strictEqual(run({ entry: "2027-01-01", cycle: "monthly" }).initialCoolingOff.to, "2027-01-15");
  assert.strictEqual(run({ entry: "2027-01-01", cycle: "monthly", goodsReceived: "2027-01-10" }).initialCoolingOff.to, "2027-01-24");
});
t("end-of-contract notice: by phone on Fri 24 Dec 2027 -> end of 31 Dec 2027 (27, 28 Dec bank holidays)", () => {
  const r = U.endNoticeDeadline("2027-12-24", false);
  assert.strictEqual(r.deadline, "2027-12-31");
  assert.deepStrictEqual(r.bankHolidays, ["2027-12-27", "2027-12-28"]);
  assert.strictEqual(U.endNoticeDeadline("2027-12-24", true).deadline, "2027-12-25");
});
t("extra reminder later than the main window is flagged", () => {
  const r = run({ entry: "2027-01-01", cycle: "annual", extraLeadDays: 10 });
  assert.strictEqual(r.reminders[0].extra.ok, false);
  assert.ok(r.warnings.some((w) => /extra reminder/.test(w)));
});
t("contracts made before 1 Jan 2027 get a warning; a zero-day window gets a warning", () => {
  assert.ok(run({ entry: "2026-12-01", cycle: "monthly" }).warnings.some((w) => /before 1 January 2027/.test(w)));
  assert.ok(run({ entry: "2027-01-01", cycle: "monthly", windowMin: 0 }).warnings.some((w) => /reasonable/.test(w)));
});
t("bad input gives errors, not a schedule", () => {
  const r = U.schedule(Object.assign({}, base, { entry: "2027-02-30", cycle: "sometimes", trial: "free" }));
  assert.strictEqual(r.errors.length, 3);
});
t("bulk CSV: rows -> sorted actions, bad rows reported, limit respected, formula guard", () => {
  const rows = U.parseCSV("id,start_date,cycle,trial,notice_days\nA1,2027-01-15,monthly,none,0\nB2,2027-01-01,annual,,\nC3,2027-13-01,monthly,none,0\n=X,2027-02-01,monthly,free:1m,0\n");
  const all = U.bulk(rows, { windowMin: 7, windowMax: 14, extraLeadDays: 30, years: 2 });
  assert.strictEqual(all.subscriptions, 3);
  assert.strictEqual(all.errors.length, 1);
  assert.ok(/Line 4/.test(all.errors[0]));
  for (let i = 1; i < all.rows.length; i++) assert.ok(all.rows[i - 1].from <= all.rows[i].from);
  assert.ok(U.toCSV(all.rows, U.OUT_COLS).includes("'=X"));
  assert.strictEqual(U.bulk(rows, { windowMin: 7, windowMax: 14, years: 2 }, 1).subscriptions, 1);
});
console.log(`\n${pass} passed`);
