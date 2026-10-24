import { GoogleGenAI } from "@google/genai";

export interface GeminiCallParams {
  contents: any;
  config?: any;
}

/**
 * Wrapper around ai.models.generateContent that handles retries and model fallbacks
 * when Gemini models experience high demand (503 UNAVAILABLE), rate limits (429), or temporary errors.
 */
export async function callGeminiWithFallback(
  ai: GoogleGenAI,
  params: GeminiCallParams,
  primaryModel: string = "gemini-3.6-flash"
) {
  const modelsToTry = Array.from(
    new Set([
      primaryModel,
      "gemini-3.6-flash",
      "gemini-3.1-flash-lite",
    ])
  );

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          ...(params.config ? { config: params.config } : {}),
        });
        if (response) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errStr = String(err?.message || err);
        console.warn(`Gemini model '${model}' attempt ${attempt + 1} failed: ${errStr.slice(0, 150)}`);
        // Pause briefly before retrying
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }
  }

  throw lastError;
}
