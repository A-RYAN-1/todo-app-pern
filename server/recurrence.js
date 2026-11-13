// Recurring todos. A recurring todo has a due date and a rule. Completing it
// creates the next one, due one step after the date it was due (not after the
// day it was ticked), so a weekly task ticked late does not drift.
const RULES = ["daily", "weekly", "monthly"];

const pad = (n) => String(n).padStart(2, "0");

// date: "YYYY-MM-DD"; returns the next due date for the rule, same format.
// A monthly rule keeps the day of the month and clamps to the length of the
// next month (31 Jan -> 28 Feb), so it never skips a month.
function nextDueDate(date, rule) {
  const [year, month, day] = date.split("-").map(Number);
  if (rule === "daily" || rule === "weekly") {
    const next = new Date(Date.UTC(year, month - 1, day + (rule === "daily" ? 1 : 7)));
    return next.toISOString().slice(0, 10);
  }
  if (rule === "monthly") {
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const daysInNextMonth = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    return `${nextYear}-${pad(nextMonth)}-${pad(Math.min(day, daysInNextMonth))}`;
  }
  throw new Error(`unknown recurrence rule: ${rule}`);
}

module.exports = { RULES, nextDueDate };
