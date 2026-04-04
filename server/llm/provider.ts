export interface LLMProvider {
  name: string;
  complete(prompt: string): Promise<string>;
}
