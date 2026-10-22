export const DEFAULT_CATEGORIES = ["Work", "Personal", "Shopping"];
export const CATEGORY_MAX_LENGTH = 50;

// The three defaults first, then every other category the user has used, A to Z.
// Names that differ only by case count as one, and the first spelling seen wins.
export function categoryOptions(todos, extra = []) {
  const seen = new Set(DEFAULT_CATEGORIES.map((name) => name.toLowerCase()));
  const custom = [];
  for (const raw of [...todos.map((todo) => todo.category), ...extra]) {
    const name = typeof raw === "string" ? raw.trim() : "";
    if (name && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      custom.push(name);
    }
  }
  custom.sort((a, b) => a.localeCompare(b));
  return [...DEFAULT_CATEGORIES, ...custom];
}
