const { Pool, types } = require("pg");

// Return DATE columns as plain YYYY-MM-DD strings; the default parses them as
// local-time Dates, which shifts the day when serialised to JSON.
types.setTypeParser(1082, (value) => value);
const { DATABASE_URL, DATABASE_SSL } = require("./config");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_SSL ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
