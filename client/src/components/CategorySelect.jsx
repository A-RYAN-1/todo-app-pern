import { useState } from "react";
import { CATEGORY_MAX_LENGTH, categoryOptions } from "../categories";

const NEW_CATEGORY = "__new__";

// A list of the user's categories with a "New category" choice that turns into a text field.
const CategorySelect = ({ value, onChange, todos, className }) => {
  const [adding, setAdding] = useState(false);
  const options = categoryOptions(todos, [value]);

  if (adding) {
    return (
      <span className="flex gap-2">
        <input
          className={className}
          type="text"
          value={value}
          maxLength={CATEGORY_MAX_LENGTH}
          placeholder="New category"
          aria-label="New category name"
          autoFocus
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="text-sm text-gray-300 underline"
          onClick={() => {
            setAdding(false);
            onChange(options[0]);
          }}
        >
          Use list
        </button>
      </span>
    );
  }

  return (
    <select
      className={className}
      value={value}
      aria-label="Category"
      onChange={(e) => {
        if (e.target.value === NEW_CATEGORY) {
          setAdding(true);
          onChange("");
        } else {
          onChange(e.target.value);
        }
      }}
    >
      {options.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
      <option value={NEW_CATEGORY}>New category...</option>
    </select>
  );
};

export default CategorySelect;
