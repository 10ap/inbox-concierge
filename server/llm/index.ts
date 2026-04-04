import type { LLMProvider } from "./provider.js";
import { ClaudeProvider } from "./claude.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";

export type { LLMProvider };

export function createProvider(name?: string): LLMProvider {
  const provider = name || process.env.LLM_PROVIDER || "claude";
  switch (provider) {
    case "claude":
      return new ClaudeProvider();
    case "openai":
      return new OpenAIProvider();
    case "gemini":
      return new GeminiProvider();
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
