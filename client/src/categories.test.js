import { categoryOptions } from "./categories";

test("shows the three defaults when there are no tasks", () => {
  expect(categoryOptions([])).toEqual(["Work", "Personal", "Shopping"]);
});

test("adds the user's own categories after the defaults, A to Z", () => {
  const todos = [{ category: "Study" }, { category: "Gym" }, { category: "Work" }];
  expect(categoryOptions(todos)).toEqual(["Work", "Personal", "Shopping", "Gym", "Study"]);
});

test("names that differ by case or spaces count once, and blanks are skipped", () => {
  const todos = [
    { category: "gym" },
    { category: " Gym " },
    { category: "work" },
    { category: "" },
    { category: null },
    {},
  ];
  expect(categoryOptions(todos)).toEqual(["Work", "Personal", "Shopping", "gym"]);
});

test("keeps a category being typed so the select can show it", () => {
  expect(categoryOptions([], ["Garden"])).toContain("Garden");
});
