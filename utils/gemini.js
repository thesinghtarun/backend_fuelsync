const { GoogleGenAI } = require("@google/genai");

async function generateContentWithFallback(config) {
  const keys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_ALTERNATE,
  ].filter(Boolean);

  let lastError;

  for (const key of keys) {
    try {
      const ai = new GoogleGenAI({
        apiKey: key,
      });

      return await ai.models.generateContent(
        config
      );
    } catch (error) {
      lastError = error;

      if (
        [429, 503].includes(
          error.status
        )
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

module.exports = {
  generateContentWithFallback,
};