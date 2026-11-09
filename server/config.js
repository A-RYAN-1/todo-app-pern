require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see server/.env.example)`);
  }
  return value;
}

const JWT_SECRET = required("JWT_SECRET");
if (JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

module.exports = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  PORT: Number(process.env.PORT) || 5000,
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:3000",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
  NL_DAILY_USER_LIMIT: Number(process.env.NL_DAILY_USER_LIMIT) || 30,
  NL_DAILY_TOTAL_LIMIT: Number(process.env.NL_DAILY_TOTAL_LIMIT) || 300,
  DATABASE_SSL: process.env.DATABASE_SSL === "true",
};
