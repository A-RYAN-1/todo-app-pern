// Evaluation run for natural-language task parsing.
//   node eval/run.js --provider rules
//   GEMINI_API_KEY=... node eval/run.js --provider gemini [--model m] [--delay-ms 4500]
// A provider failure (network, quota, bad key) stops the run with exit code 2 and
// scores nothing; only answers the model actually gave are scored. The prompt is
// tuned on the dev cases only; the holdout cases (every fourth) are reported apart.
const fs = require("fs");
const path = require("path");
const { parseTask } = require("../nlparse/baseline");
const { createGemini, ProviderError } = require("../nlparse/gemini");
const { fromModelText, weekdayOf } = require("../nlparse");
const { PROMPT_VERSION } = require("../nlparse/prompt");
const { scoreCase, summarize, isHoldout } = require("./score");

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, tries = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof ProviderError) || !err.retryable || attempt === tries) throw err;
      await sleep(attempt * 8000);
    }
  }
}

async function main() {
  const set = JSON.parse(
    fs.readFileSync(path.join(__dirname, opt("set", "cases") + ".json"), "utf8")
  );
  const kind = opt("provider", "rules");
  const delay = Number(opt("delay-ms", "4500"));
  let provider = null;
  if (kind === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is not set; nothing was run.");
      process.exit(2);
    }
    provider = createGemini({ apiKey, model: opt("model", "gemini-3.5-flash-lite") });
  }
  const results = [];
  let invalid = 0;
  for (let i = 0; i < set.cases.length; i++) {
    const c = set.cases[i];
    let got;
    if (provider) {
      const ctx = {
        text: c.input.replace(/\s+/g, " ").trim(),
        today: set.today,
        weekday: weekdayOf(set.today),
        categories: set.categories,
      };
      let raw;
      try {
        raw = await withRetry(() => provider.complete(ctx));
      } catch (err) {
        console.error(
          `Provider failure on case ${i + 1} (${err.message}); run stopped, nothing scored.`
        );
        process.exit(2);
      }
      try {
        got = fromModelText(raw, set.categories);
      } catch {
        invalid++;
        got = { description: "", due_date: null, priority: "", category: null };
      }
      await sleep(delay);
    } else {
      got = parseTask(c.input, { today: set.today, categories: set.categories });
    }
    results.push({
      i,
      input: c.input,
      expected: c,
      got,
      holdout: isHoldout(i),
      score: scoreCase(c, got),
    });
  }
  const report = {
    date: new Date().toISOString().slice(0, 10),
    provider: provider ? provider.name : "rules",
    prompt: provider ? PROMPT_VERSION : null,
    today: set.today,
    invalidAnswers: invalid,
    all: summarize(results),
    dev: summarize(results.filter((r) => !r.holdout)),
    holdout: summarize(results.filter((r) => r.holdout)),
  };
  console.log(JSON.stringify(report, null, 1));
  const out = opt("out", null);
  if (out) fs.writeFileSync(out, JSON.stringify({ report, results }, null, 1));
  if (args.includes("--misses")) {
    for (const r of results.filter((x) => !x.score.all)) {
      console.log(
        `\n[${r.holdout ? "holdout" : "dev"} ${r.i}] ${r.input}\n  want ${JSON.stringify({ ...r.expected, input: undefined })}\n  got  ${JSON.stringify(r.got)}`
      );
    }
  }
}

main();
