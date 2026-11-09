// Gemini REST provider (free tier), JSON mode, temperature 0. The key comes from
// the environment and is only ever sent in the x-goog-api-key header.
const { SYSTEM, userMessage } = require("./prompt");

const BASE = "https://generativelanguage.googleapis.com/v1beta/models/";

class ProviderError extends Error {
  constructor(message, { status = null, retryable = false } = {}) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.retryable = retryable;
  }
}

function createGemini({
  apiKey,
  model = "gemini-3.5-flash-lite",
  timeoutMs = 8000,
  fetchImpl = fetch,
}) {
  if (!apiKey) throw new Error("apiKey is required");
  return {
    name: `gemini:${model}`,
    async complete(input) {
      let res;
      try {
        res = await fetchImpl(`${BASE}${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: "user", parts: [{ text: userMessage(input) }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0 },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        throw new ProviderError(`request failed: ${err.name}`, { retryable: true });
      }
      if (!res.ok) {
        throw new ProviderError(`provider answered ${res.status}`, {
          status: res.status,
          retryable: res.status === 429 || res.status >= 500,
        });
      }
      const body = await res.json();
      const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") throw new ProviderError("provider returned no text");
      return text;
    },
  };
}

module.exports = { createGemini, ProviderError };
