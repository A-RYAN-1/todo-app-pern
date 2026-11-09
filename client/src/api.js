// Turns a failed response into a message the user can act on. The API answers
// with { error: "..." }; anything else falls back to the generic text.
export async function errorMessage(response, fallback) {
  try {
    const body = await response.json();
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // not JSON
  }
  return fallback;
}

export const authHeader = () => ({ Authorization: localStorage.getItem("token") || "" });

// Today's date on the user's own clock as YYYY-MM-DD (toISOString would give the UTC day).
export function localDate(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
