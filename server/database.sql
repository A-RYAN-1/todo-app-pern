CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS todo (
    todo_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    description VARCHAR(300),
    due_date DATE,
    priority VARCHAR(10) DEFAULT 'Low' CHECK (priority IN ('Low', 'Medium', 'High')),
    category VARCHAR(50),
    completed BOOLEAN DEFAULT FALSE
);

-- Added with recurring todos. Safe to run again.
ALTER TABLE todo ADD COLUMN IF NOT EXISTS recurrence VARCHAR(10)
    CHECK (recurrence IN ('daily', 'weekly', 'monthly'));

-- Added with subtasks and manual order. Safe to run again.
-- A subtask is a todo row with parent_id set; deleting the parent deletes its subtasks in the same statement.
-- position orders the top-level todos of a user, and the subtasks of one parent.
ALTER TABLE todo ADD COLUMN IF NOT EXISTS parent_id INTEGER REFERENCES todo(todo_id) ON DELETE CASCADE
    CHECK (parent_id <> todo_id);
ALTER TABLE todo ADD COLUMN IF NOT EXISTS position INTEGER;
CREATE INDEX IF NOT EXISTS todo_parent_idx ON todo (parent_id);
-- Existing todos keep the order they were listed in (due date, then id).
UPDATE todo SET position = ranked.n
  FROM (SELECT todo_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY due_date ASC NULLS LAST, todo_id ASC) AS n
          FROM todo WHERE position IS NULL AND parent_id IS NULL) ranked
 WHERE todo.todo_id = ranked.todo_id;
