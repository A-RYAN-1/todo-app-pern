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
