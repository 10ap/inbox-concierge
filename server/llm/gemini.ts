import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMProvider } from "./provider.js";

export class GeminiProvider implements LLMProvider {
  name = "gemini";
  private client: GoogleGenerativeAI;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }

  async complete(prompt: string): Promise<string> {
    const model = this.client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
