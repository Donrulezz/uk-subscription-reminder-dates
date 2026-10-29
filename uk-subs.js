/* UK subscription contracts date engine: DMCCA 2024 Part 4 Chapter 2 and the draft Consumer Subscription Contracts
   (Cancellation and Information) Regulations 2026 ("SCRs"), for contracts made on or after 1 January 2027.
   Runs in the browser and in Node (tests); nothing leaves the page.
   Spec with every source: docs/research/uk-subscriptions-spec-2026-10-29.md (§10 = the arithmetic used here).
   - Which renewal payments need a reminder: s.258 (six-month periods from the day after entry, or after the last
     reminded payment; the last payment in each period, else the first after it), trials/intro prices s.258(3)-(4),
     reg 33 (same discounted price for several payments: remind for the first higher-priced one).
   - Extra earlier reminder when the next payment is more than 12 months away: s.259(6)-(8).
   - Renewal cooling-off (14 days) after the first payment following a trial/intro price and after 12-month-plus
     renewals: s.265(2)-(4). Initial cooling-off: s.265(1).
   - End-of-contract notice: 24 hours if the customer ended online, else 3 working days (no UK bank holiday in any
     nation): s.261(5), s.330.
   The law sets NO reminder window in days: the trader states one in the key information (Sch 23 para 10) and it must
   be reasonable (s.259(3)-(5)). The window here is the user's input; any default is our assumption, not law. */
(function (root) {
  "use strict";
  var DAY = 86400000;
  // gov.uk/bank-holidays.json, union of England and Wales, Scotland and Northern Ireland (s.330), fetched 29 Oct 2026.
  var BANK_HOLIDAYS = ["2026-11-30", "2026-12-25", "2026-12-28", "2027-01-01", "2027-01-04", "2027-03-17", "2027-03-26",
    "2027-03-29", "2027-05-03", "2027-05-31", "2027-07-12", "2027-08-02", "2027-08-30", "2027-11-30", "2027-12-27",
    "2027-12-28", "2028-01-03", "2028-01-04", "2028-03-17", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29",
    "2028-07-12", "2028-08-07", "2028-08-28", "2028-11-30", "2028-12-25", "2028-12-26"];
  var BH = {};
  BANK_HOLIDAYS.forEach(function (d) { BH[d] = 1; });
  var BH_LAST = BANK_HOLIDAYS[BANK_HOLIDAYS.length - 1];
  var START = "2027-01-01";  // the regime applies to contracts entered into on or after this day (G FAQ 1)

  function day(v) {  // YYYY-MM-DD or D/M/YYYY (UK) -> UTC ms, NaN if unreadable
    var s = String(v || "").trim(), m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return valid(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s))) return valid(+m[3], +m[2], +m[1]);
    return NaN;
  }
  function valid(y, mo, d) {
    var t = Date.UTC(y, mo - 1, d), x = new Date(t);
    return x.getUTCFullYear() === y && x.getUTCMonth() === mo - 1 && x.getUTCDate() === d ? t : NaN;
  }
  function iso(ms) { return new Date(ms).toISOString().slice(0, 10); }
  function add(ms, n) { return ms + n * DAY; }
  function daysIn(y, m0) { return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate(); }

  // Billing date k months after an anchor day, kept on the anchor's day number (31 Jan -> 28/29 Feb -> 31 Mar).
  function addMonths(ms, n) {
    var x = new Date(ms), y = x.getUTCFullYear(), m = x.getUTCMonth() + n, d = x.getUTCDate();
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return Date.UTC(y, m, Math.min(d, daysIn(y, m)));
  }
  // Last day of "a period of n months beginning with" start: the day before the same day number n months later, or
  // the last day of that month when the day number doesn't exist there (spec §10.1; UNCONFIRMED for this statute).
  function periodEnd(start, n) {
    var x = new Date(start), y = x.getUTCFullYear(), m = x.getUTCMonth() + n, d = x.getUTCDate();
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return d <= daysIn(y, m) ? add(Date.UTC(y, m, d), -1) : Date.UTC(y, m, daysIn(y, m));
  }
  function workingDay(ms) {
    var w = new Date(ms).getUTCDay();
    return w !== 0 && w !== 6 && !BH[iso(ms)];
  }

  // cycle: {unit: "week"|"month", n}. trial: {kind: "none"} | {kind: "free", unit: "day"|"month", n}
  //   | {kind: "intro", payments: K} (the same lower price for the first K payments, the first taken at sign-up).
  function parseCycle(s) {
    var t = String(s || "").trim().toLowerCase(), m;
    var named = { weekly: [1, "week"], fortnightly: [2, "week"], monthly: [1, "month"], bimonthly: [2, "month"],
      quarterly: [3, "month"], "half-yearly": [6, "month"], "6-monthly": [6, "month"], annual: [12, "month"],
      annually: [12, "month"], yearly: [12, "month"] };
    if (named[t]) return { n: named[t][0], unit: named[t][1] };
    if ((m = /^(\d+)\s*(w|wk|wks|week|weeks|m|mo|month|months|y|yr|year|years)$/.exec(t))) {
      var u = m[2][0], n = +m[1];
      if (n < 1) return null;
      return u === "w" ? { n: n, unit: "week" } : u === "y" ? { n: n * 12, unit: "month" } : { n: n, unit: "month" };
    }
    return null;
  }
  function parseTrial(s) {
    var t = String(s || "").trim().toLowerCase(), m;
    if (t === "" || t === "none" || t === "no") return { kind: "none" };
    if ((m = /^free\s*:?\s*(\d+)\s*(d|day|days|m|mo|month|months)$/.exec(t)) && +m[1] > 0)
      return { kind: "free", n: +m[1], unit: m[2][0] === "d" ? "day" : "month" };
    if ((m = /^intro\s*:?\s*(\d+)$/.exec(t)) && +m[1] > 0) return { kind: "intro", payments: +m[1] };
    return null;
  }
  function step(ms, cycle, k) { return cycle.unit === "week" ? add(ms, 7 * cycle.n * k) : addMonths(ms, cycle.n * k); }

  // Renewal payments: the days the customer becomes liable for each payment they could avoid by ending the contract
  // (s.258(7); liability arises on the period start, reg 37). Generated up to `until`.
  function renewals(entry, cycle, trial, until, fixedEnd) {
    var out = [], first, k, r, i;
    if (trial.kind === "free") {
      first = trial.unit === "day" ? add(entry, trial.n) : addMonths(entry, trial.n);
      for (k = 0; (r = step(first, cycle, k)) <= until; k++) {
        if (fixedEnd && r > fixedEnd) break;
        out.push({ date: r, intro: false });
      }
    } else {
      for (k = 1; (r = step(entry, cycle, k)) <= until; k++) {
        if (fixedEnd && r > fixedEnd) break;
        out.push({ date: r, intro: trial.kind === "intro" && k < trial.payments });
      }
    }
    for (i = 0; i < out.length; i++) out[i].index = i;
    return out;
  }

  function schedule(input) {
    var errors = [], warnings = [];
    var entry = day(input.entry), cycle = typeof input.cycle === "object" ? input.cycle : parseCycle(input.cycle);
    var trial = typeof input.trial === "object" && input.trial ? input.trial : parseTrial(input.trial);
    var notice = input.noticeDays === undefined || input.noticeDays === "" ? 0 : Math.floor(+input.noticeDays);
    var wMin = Math.floor(+input.windowMin), wMax = Math.floor(+input.windowMax);
    var lead = input.extraLeadDays === undefined || input.extraLeadDays === "" ? NaN : Math.floor(+input.extraLeadDays);
    var fixedEnd = input.fixedEnd ? day(input.fixedEnd) : null;
    var goods = input.goodsReceived ? day(input.goodsReceived) : null;
    var years = input.years ? +input.years : 3;
    if (isNaN(entry)) errors.push("Start date: use YYYY-MM-DD.");
    if (!cycle) errors.push("Billing cycle: use e.g. monthly, quarterly, annual, weekly, 2 weeks or 3 months.");
    if (!trial) errors.push("Trial: use none, free:14d, free:1m or intro:3.");
    if (!(notice >= 0)) errors.push("Notice period: a whole number of days, 0 if none.");
    if (!(wMin >= 0) || !(wMax >= 0) || wMax < wMin) errors.push("Reminder window: two whole numbers of days, the larger one second.");
    if (fixedEnd !== null && isNaN(fixedEnd)) errors.push("Fixed end date: use YYYY-MM-DD.");
    if (goods !== null && isNaN(goods)) errors.push("Goods received date: use YYYY-MM-DD.");
    if (errors.length) return { errors: errors };
    if (iso(entry) < START) warnings.push("This contract was made before 1 January 2027. The new rules apply only to contracts made on or after that day (draft guidance FAQ 1).");
    if (wMin === 0) warnings.push("A window that ends on the last day to cancel leaves no time to act; it is unlikely to be reasonable (s.259(4); G FAQ 21).");

    var horizon = addMonths(entry, years * 12);
    var all = renewals(entry, cycle, trial, addMonths(horizon, 30), fixedEnd);  // look past the horizon for "next" payments
    var conc = trial.kind !== "none";
    var reg33 = trial.kind === "intro" && trial.payments >= 2;  // >=1 renewal at the same fixed original rate (reg 33(2))
    var events = [], picked = {}, safety = {};

    if (!all.length) return { errors: [], warnings: warnings.concat("No renewal payment in the period shown."), events: [], reminders: [] };
    var firstHigher = all.filter(function (r) { return !r.intro; })[0];
    var first = conc ? (reg33 ? firstHigher : all[0]) : null;
    // The chain of s.258 periods. shift 0 = the usual reading (a 6-month period beginning 16 Jan ends 15 Jul); shift 1
    // reads it as ending a day later. Where the two disagree near a boundary, remind for both (spec §10.1: an extra
    // reminder is never a breach); the second reading's extra dates are marked as safety reminders.
    function chain(shift) {
      var got = {}, anchor;
      if (conc) {
        if (!first) return got;
        got[first.index] = reg33 ? "first payment at the full price after the intro price (s.258(3)(a); reg 33)"
          : "first payment after the trial or intro price (s.258(3)(a))";
        anchor = first.date;
      } else anchor = entry;
      while (anchor <= horizon) {
        var ps = add(anchor, 1), pe = add(periodEnd(ps, 6), shift);
        var inP = all.filter(function (r) { return r.date >= ps && r.date <= pe; });
        var next = inP.length ? inP[inP.length - 1] : all.filter(function (r) { return r.date > pe; })[0];
        if (!next) break;
        got[next.index] = inP.length ? "last payment in the six months from " + iso(ps) + " (s.258(2), (5))"
          : "first payment after the six months from " + iso(ps) + " (s.258(5))";
        anchor = next.date;
      }
      return got;
    }
    var main = chain(0), alt = chain(1);
    Object.keys(main).forEach(function (k) { picked[k] = main[k]; });
    Object.keys(alt).forEach(function (k) {
      if (!picked[k]) { picked[k] = "safety reminder: only needed if the six-month period is counted one day longer"; safety[k] = 1; }
    });

    var reminders = [];
    all.forEach(function (r, idx) {
      if (!picked[r.index] || r.date > horizon) return;
      var R = r.date, lcd = add(R, -1 - notice), from = add(lcd, -wMax), to = add(lcd, -wMin);
      var nextR = all[idx + 1], pEnd = periodEnd(add(R, -1), 12);
      var long = nextR ? nextR.date > pEnd : !!(fixedEnd && fixedEnd > pEnd);
      var rem = { renewal: iso(R), reason: picked[r.index], safety: !!safety[r.index], lastCancel: iso(lcd), sendFrom: iso(from),
        sendTo: iso(to), nextPayment: nextR ? iso(nextR.date) : null, extra: null, coolingOff: null };
      if (long) {
        var ex = isNaN(lead) ? null : add(R, -lead);
        rem.extra = { sendBefore: iso(add(from, -1)), suggested: ex === null ? null : iso(ex),
          ok: ex === null ? null : ex < from };
        if (ex !== null && ex >= from) warnings.push("The extra reminder for " + iso(R) + " must go before the main reminder window starts (" + iso(from) + ") (s.259(6)).");
      }
      reminders.push(rem);
    });
    // Renewal cooling-off: first payment after the trial/intro ends, and payments followed by a 12-month-plus gap.
    all.forEach(function (r, idx) {
      if (r.date > horizon) return;
      var firstAfter = conc && r === first;
      var nextR = all[idx + 1], pEnd = periodEnd(add(r.date, -1), 12);
      var long = nextR ? nextR.date > pEnd : !!(fixedEnd && fixedEnd > pEnd);
      if (!firstAfter && !long) return;
      var rem = reminders.filter(function (x) { return x.renewal === iso(r.date); })[0];
      var co = { from: iso(r.date), to: iso(add(r.date, 14)), noticeDue: iso(r.date),
        why: firstAfter ? "first payment after the trial or intro price (s.265(3)(a))" : "the next payment is more than 12 months away (s.265(3)(b))" };
      if (rem) rem.coolingOff = co;
      else reminders.push({ renewal: iso(r.date), reason: null, coolingOff: co });
    });
    reminders.sort(function (a, b) { return a.renewal < b.renewal ? -1 : 1; });

    var icop = { from: iso(entry), to: iso(add(goods !== null ? goods : entry, 14)),
      basis: goods !== null ? "14 days after the goods arrived (s.265(1)(b))" : "14 days after the contract was made (s.265(1))" };
    reminders.forEach(function (r) {
      if (r.reason) events.push({ date: r.sendFrom, to: r.sendTo, kind: r.safety ? "safety-reminder" : "reminder", renewal: r.renewal,
        text: (r.safety ? "Safety reminder (date-counting edge case) for " : "Send the renewal reminder for the payment due ") + r.renewal
          + ", between " + r.sendFrom + " and " + r.sendTo });
      if (r.extra) events.push({ date: r.extra.suggested || r.extra.sendBefore, to: r.extra.sendBefore, kind: "extra", renewal: r.renewal,
        text: "Send the additional earlier reminder for " + r.renewal + " before " + r.extra.sendBefore });
      if (r.coolingOff) events.push({ date: r.coolingOff.from, to: r.coolingOff.to, kind: "cooling-off", renewal: r.renewal,
        text: "Send the renewal cooling-off notice on " + r.coolingOff.noticeDue + "; the customer may cancel until " + r.coolingOff.to });
    });
    events.push({ date: icop.from, to: icop.to, kind: "initial-cooling-off", renewal: null,
      text: "Initial cooling-off period: until " + icop.to + " (" + icop.basis + ")" });
    events.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return { errors: [], warnings: warnings, reminders: reminders, events: events, initialCoolingOff: icop,
      renewalCount: all.filter(function (r) { return r.date <= horizon; }).length, horizon: iso(horizon) };
  }

  // End-of-contract notice: within 24 hours when the customer ended online, otherwise by the end of the third working
  // day starting with the day after (s.261(5)(b), s.330).
  function endNoticeDeadline(notified, online) {
    var t = day(notified);
    if (isNaN(t)) return { error: "Date: use YYYY-MM-DD." };
    if (online) return { deadline: iso(add(t, 1)), rule: "within 24 hours of being told (s.261(5)(b)(i))" };
    var d = t, n = 0, skipped = [];
    while (n < 3) {
      d = add(d, 1);
      if (iso(d) > BH_LAST) return { error: "Bank holiday data runs to " + BH_LAST + "." };
      if (workingDay(d)) n++;
      else if (BH[iso(d)]) skipped.push(iso(d));
    }
    return { deadline: iso(d), rule: "by the end of the third working day after being told (s.261(5)(b)(ii); s.330)", bankHolidays: skipped };
  }

  // CSV in (one subscription per row) -> schedule rows out. Columns: id, start_date, cycle, trial, notice_days,
  // fixed_end_date (optional), goods_received_date (optional).
  function parseCSV(text) {
    var rows = [], row = [], f = "", q = false, i, c;
    text = String(text || "").replace(/^﻿/, "");
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(f); f = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
      else f += c;
    }
    if (f !== "" || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim().toLowerCase(); });
    return rows.slice(1).map(function (r, k) {
      var o = { _line: k + 2 };
      head.forEach(function (h, j) { o[h] = (r[j] || "").trim(); });
      return o;
    });
  }
  function bulk(rows, opts, limit) {
    var out = [], errors = [], done = 0;
    rows.forEach(function (r) {
      if (limit && done >= limit) return;
      var res = schedule({ entry: r.start_date, cycle: r.cycle, trial: r.trial, noticeDays: r.notice_days,
        windowMin: opts.windowMin, windowMax: opts.windowMax, extraLeadDays: opts.extraLeadDays,
        fixedEnd: r.fixed_end_date, goodsReceived: r.goods_received_date, years: opts.years });
      if (res.errors.length) { errors.push("Line " + r._line + " (" + (r.id || "no id") + "): " + res.errors.join(" ")); return; }
      done++;
      res.events.forEach(function (e) {
        out.push({ id: r.id || "", action: e.kind, from: e.date, to: e.to || "", renewal_payment: e.renewal || "", what: e.text });
      });
    });
    out.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    return { rows: out, errors: errors, subscriptions: done };
  }
  var OUT_COLS = ["id", "action", "from", "to", "renewal_payment", "what"];
  function toCSV(rows, cols) {
    function cell(v) {
      v = v === null || v === undefined ? "" : String(v);
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;  // no formulas when opened in a spreadsheet
      return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }
    return [cols.join(",")].concat(rows.map(function (r) { return cols.map(function (c) { return cell(r[c]); }).join(","); })).join("\n");
  }

  var api = { schedule: schedule, endNoticeDeadline: endNoticeDeadline, parseCSV: parseCSV, bulk: bulk, toCSV: toCSV,
    OUT_COLS: OUT_COLS, parseCycle: parseCycle, parseTrial: parseTrial, periodEnd: periodEnd, addMonths: addMonths,
    day: day, iso: iso, workingDay: workingDay, BANK_HOLIDAYS: BANK_HOLIDAYS };
  root.UKSubs = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
