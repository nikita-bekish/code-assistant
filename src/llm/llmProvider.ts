/**
 * LLM Provider Interface - abstraction for different LLM providers
 */

export interface LLMProvider {
  invoke(prompt: string): Promise<string>;
  name: string;
}

export interface LLMConfig {
  provider: 'ollama' | 'openai';
  model: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  apiKey?: string; // For OpenAI
  baseUrl?: string; // For Ollama
}
