# Natural-language task parsing: evaluation

`POST /todos/parse` turns one typed sentence into todo fields. This folder measures it.

## What is measured

- `cases.json`: 85 hand-labelled sentences. Today is fixed to Monday 2026-11-09 so answers are repeatable. Every fourth case (21) is held out: the prompt was never tuned on them.
- `fresh.json`: 25 differently worded sentences written after prompt v2, before either parser was run on them. Not used for tuning.
- Fields: description (letters and digits only, case ignored), due date, priority and category. **Core** means description, due date and priority all correct; category is reported apart because its labels are partly a matter of taste.
- Date rules: a bare weekday, or "next <weekday>", is the first such day after today; "tonight" and "end of day" are today; "this weekend" is the coming Saturday; "next week" alone is +7 days. Priority: urgent, asap, important, high -> High; medium, normal -> Medium; low, whenever or nothing -> Low. Category only when the line names it or clearly belongs to it.

## Run it

```
cd server
node eval/run.js --provider rules                       # no key, no network
GEMINI_API_KEY=... node eval/run.js --provider gemini   # about 7 minutes at the free-tier pace
node eval/run.js --set fresh --provider gemini --misses
```

A provider failure (quota, network, bad key) stops the run with exit code 2 and nothing is scored. An answer the model did give but that fails validation counts as a miss and is reported as `invalidAnswers`. Raw results are in `results/`.

## Results (2026-11-09, `gemini-3.5-flash-lite`, temperature 0)

| Set         | Parser          | Core                 | Date     | Category | Whole case |
| ----------- | --------------- | -------------------- | -------- | -------- | ---------- |
| 85 cases    | rules           | 95.3%                | 98.8%    | 80.0%    | 78.8%      |
| 85 cases    | prompt v1       | 94.1%                | not kept | 72.9%    | 67.1%      |
| 85 cases    | prompt v2       | 94.1%                | 97.6%    | 63.5%    | 58.8%      |
| 21 held out | rules / v1 / v2 | 95.2% / 90.5% / 100% |          |          |            |
| 25 fresh    | rules           | 68.0%                | 84.0%    | 40.0%    | 24.0%      |
| 25 fresh    | prompt v2       | 84.0%                | 96.0%    | 44.0%    | 36.0%      |

Read with care:

- The rule parser's keyword lists were written with the 85 cases in view, so its score on them is optimistic. The 25 fresh cases are the fairer comparison, and 25 is a small sample.
- v1 to v2 added a 14-day calendar built in code and a rule for month-and-day dates. Core did not move overall (dev 95.3% to 92.2%, held out 90.5% to 100%); the difference is within noise at these sizes.
- Category got worse with the model on the 85 cases: it often adds a category the label leaves empty. The form lets the user change it before saving.
- One test run is one sample: a second run could differ by a case or two even at temperature 0.
