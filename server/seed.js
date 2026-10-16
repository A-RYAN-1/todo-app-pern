// Creates the demo account with two sample todos if it does not exist. Run: npm run seed
const bcrypt = require("bcrypt");
const pool = require("./connect_server_and_database");

(async () => {
  const hash = await bcrypt.hash("demo-pass-123", 10);
  const user = await pool.query(
    "INSERT INTO users (username, password) VALUES ('demo', $1) ON CONFLICT (username) DO NOTHING RETURNING user_id",
    [hash]
  );
  if (user.rows.length > 0) {
    await pool.query(
      "INSERT INTO todo (user_id, description, due_date, priority, category) VALUES ($1, 'Try editing or completing me', CURRENT_DATE + 7, 'High', 'demo'), ($1, 'Export these as JSON', CURRENT_DATE + 14, 'Low', 'demo')",
      [user.rows[0].user_id]
    );
    console.log("demo account created");
  } else {
    console.log("demo account already exists");
  }
  await pool.end();
})().catch((err) => {
  console.error("seed failed:", err.message);
  process.exit(1);
});
