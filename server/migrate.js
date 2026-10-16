// Applies database.sql (idempotent: CREATE TABLE IF NOT EXISTS). Run: npm run migrate
const fs = require("fs");
const path = require("path");
const pool = require("./connect_server_and_database");

(async () => {
  await pool.query(fs.readFileSync(path.join(__dirname, "database.sql"), "utf8"));
  console.log("migrations applied");
  await pool.end();
})().catch((err) => {
  console.error("migration failed:", err.message);
  process.exit(1);
});
