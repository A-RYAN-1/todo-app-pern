// Rule-based task parser. It is the baseline the model is measured against and
// the fallback when no model key is set or the provider fails, so the form
// helper always works. No network, no randomness: same text and date in, same
// fields out.

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const WORK_CUES =
  /\b(work|office|client|standup|sprint|meeting|manager|deploy|pull request|bug|invoice|report|slides|legal|contract|expense|reimbursement|migration|quarterly|onboarding|tests?)\b/i;
const SHOP_CUES = /\b(buy|order|groceries|grocery|shopping|purchase)\b/i;
const PERSONAL_CUES =
  /\b(mum|mom|dad|grandma|dentist|doctor|gym|plants|kitchen|trash|haircut|rent|family|kids|vet|prescription|birthday)\b/i;

function pad(n) {
  return String(n).padStart(2, "0");
}

function iso(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function parseToday(today) {
  const d = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error("today must be YYYY-MM-DD");
  return d;
}

// Each rule: a regex that finds the date phrase and a function giving the date.
function dateRules(base) {
  const month = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase());
  const monthPattern =
    "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  const nextOccurrence = (monthIndex, day) => {
    let year = base.getUTCFullYear();
    let d = new Date(Date.UTC(year, monthIndex, day));
    if (d.getUTCMonth() !== monthIndex) return null;
    if (d < base) d = new Date(Date.UTC(year + 1, monthIndex, day));
    return d;
  };
  return [
    { re: /\b(\d{4}-\d{2}-\d{2})\b/, to: (m) => parseToday(m[1]) },
    { re: /\bin (\d+) days?\b/i, to: (m) => addDays(base, Number(m[1])) },
    { re: /\bin (\d+) weeks?\b/i, to: (m) => addDays(base, 7 * Number(m[1])) },
    { re: /\b(\d+) weeks? from now\b/i, to: (m) => addDays(base, 7 * Number(m[1])) },
    { re: /\bin a month\b/i, to: () => addDays(base, 30) },
    { re: /\b(?:today|tonight|end of day|eod)\b/i, to: () => base },
    { re: /\btomorrow\b/i, to: () => addDays(base, 1) },
    { re: /\b(?:this )?weekend\b/i, to: () => addDays(base, (6 - base.getUTCDay() + 7) % 7 || 7) },
    { re: /\bnext week\b/i, to: () => addDays(base, 7) },
    {
      re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthPattern}\\b`, "i"),
      to: (m) => nextOccurrence(month(m[2]), Number(m[1])),
    },
    {
      re: new RegExp(`\\b${monthPattern}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, "i"),
      to: (m) => nextOccurrence(month(m[1]), Number(m[2])),
    },
    {
      re: /\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/i,
      to: (m) => {
        const day = Number(m[1]);
        let d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
        if (d < base) d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, day));
        return d;
      },
    },
    {
      re: new RegExp(`\\b(?:next |on )?(${WEEKDAYS.join("|")})\\b`, "i"),
      to: (m) => {
        const target = WEEKDAYS.indexOf(m[1].toLowerCase());
        const delta = (target - base.getUTCDay() + 7) % 7 || 7;
        return addDays(base, delta);
      },
    },
  ];
}

function parsePriority(text) {
  if (/\b(urgent|asap|important|high( priority)?)\b/i.test(text)) return "High";
  if (/\b(medium|normal)( priority)?\b/i.test(text)) return "Medium";
  return "Low";
}

function parseCategory(text, categories) {
  const lower = text.toLowerCase();
  for (const name of categories) {
    if (new RegExp(`\\b${name.toLowerCase()}\\b`).test(lower)) return name;
  }
  const has = (name) => categories.includes(name);
  if (has("Work") && WORK_CUES.test(text)) return "Work";
  if (has("Shopping") && SHOP_CUES.test(text)) return "Shopping";
  if (has("Personal") && PERSONAL_CUES.test(text)) return "Personal";
  return null;
}

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function parseTask(text, { today, categories = [] }) {
  const base = parseToday(today);
  let rest = String(text).replace(/\s+/g, " ").trim();
  let dueDate = null;
  for (const rule of dateRules(base)) {
    const match = rest.match(rule.re);
    if (match) {
      const d = rule.to(match);
      if (d) {
        dueDate = iso(d);
        rest = rest.replace(match[0], " ");
        break;
      }
    }
  }
  const priority = parsePriority(rest);
  const category = parseCategory(rest, categories);

  rest = rest
    .replace(/\b(urgent|asap|important|high|medium|normal|low)( priority)?\b/gi, " ")
    .replace(/\b(?:at|@)?\s*\d{1,2}(:\d{2})?\s?(am|pm)\b/gi, " ")
    .replace(/\b(morning|evening|noon|afternoon|now)\b/gi, " ")
    .replace(/\b(?:remind me to|please)\b/gi, " ")
    .replace(/\b(?:for|at|in)\s+(work|office)\b/gi, " ")
    .replace(/\b(work|whenever|sometime)\b/gi, " ")
    .replace(/\b(by|on|for|until|due)\s*$/i, " ")
    .replace(/^\s*[:\-,]+|[:\-,]+\s*$/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(by|on|for|due|the|urgent)\b\s*/i, "")
    .replace(/\s+(by|on|for|due)\s*$/i, "")
    .trim();
  return { description: titleCase(rest), due_date: dueDate, priority, category };
}

module.exports = { parseTask };
