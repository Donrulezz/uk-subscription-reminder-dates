# uk-subscription-reminder-dates

**The dates the UK subscription contract rules require, from 1 January 2027: which renewal payments need a reminder,
when to send it, the extra reminder for annual plans, the cooling-off windows and the end-of-contract notice deadline.**

The Digital Markets, Competition and Consumers Act 2024 (Part 4, Chapter 2) applies to subscriptions sold to UK consumers,
including by sellers outside the UK, for contracts made on or after 1 January 2027. The rules are about dates, and most
billing tools don't produce them: a reminder is due for about one payment in six on a monthly plan (worked out from
six-month periods), annual plans need an extra earlier reminder, the first payment after a free trial starts a 14-day
cooling-off period, and the trader must state its own reminder window. This is the date logic as one dependency-free
JavaScript file for Node and the browser.

```js
const U = require("./uk-subs.js");
const r = U.schedule({
  entry: "2027-01-15", cycle: "monthly", trial: "free:14d",
  noticeDays: 0,            // your notice period to cancel
  windowMin: 7, windowMax: 14,  // your stated reminder window, in days before the last day to cancel
  extraLeadDays: 30, years: 2,
});
```
```
Send the renewal reminder for the payment due 2027-01-29, between 2027-01-14 and 2027-01-21
Initial cooling-off period: until 2027-01-29 (14 days after the contract was made (s.265(1)))
Send the renewal cooling-off notice on 2027-01-29; the customer may cancel until 2027-02-12
Send the renewal reminder for the payment due 2027-07-29, between 2027-07-14 and 2027-07-21
Send the renewal reminder for the payment due 2028-01-29, between 2028-01-14 and 2028-01-21
```

`r.reminders` holds each reminder with the payment it is for, the legal reason, the send-from / send-to dates and the
cooling-off window it opens; `r.events` is the same as one dated list; `r.errors` / `r.warnings` explain bad input.

| Function | Use |
|---|---|
| `schedule(input)` | Every reminder, extra reminder and cooling-off window for one subscription |
| `endNoticeDeadline(date, online)` | When the end-of-contract notice is due (24 hours if the customer ended online, else the end of the 3rd working day, UK bank holidays excluded) |
| `parseCSV`, `bulk(rows, opts)`, `toCSV` | A whole subscriber list: columns `id, start_date, cycle, trial, notice_days, fixed_end_date, goods_received_date` |

Cycles: `monthly`, `quarterly`, `annual`, `weekly`, `2 weeks`, `3 months` and similar. Trials: `none`, `free:14d`,
`free:1m`, `intro:3` (three payments at an introductory price).

## Sources

- [Digital Markets, Competition and Consumers Act 2024, Part 4 Chapter 2](https://www.legislation.gov.uk/ukpga/2024/13/part/4/chapter/2) (s.258 reminder periods, s.259 extra reminder, s.261 and s.330 ending, s.265 cooling-off)
- Draft Consumer Subscription Contracts (Cancellation and Information) Regulations 2026 and the government's draft guidance of 19 October 2026 (reg 33: introductory prices)

Where the text is unclear the code takes the reading that sends a reminder rather than skips one, and marks the extra
dates as safety reminders. The draft Regulations still need Parliament's approval: check the final text.

Try it without code at [deadlinefix.com/uk-subscription-rules-2027](https://deadlinefix.com/uk-subscription-rules-2027).

## Tests

`node test.js` runs the statute's worked examples (six-month periods, trials, annual extra reminder, weekly plans,
month-end starts, fixed terms, bank holidays).

MIT licensed. Not legal advice. Not affiliated with the CMA or the Department for Business and Trade.
