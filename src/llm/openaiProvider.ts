import OpenAI from 'openai';
import { LLMProvider, LLMConfig } from './llmProvider.js';

/**
 * OpenAI LLM Provider
 * Implements LLMProvider interface for OpenAI models
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  private client: OpenAI;
  private model: string;
  private temperature: number;
  private maxTokens: number;

  constructor(config: LLMConfig) {
    if (!config.apiKey) {
      throw new Error('OpenAI API key not provided. Set OPENAI_API_KEY environment variable.');
    }

    this.client = new OpenAI({
      apiKey: config.apiKey,
    });

    this.model = config.model || 'gpt-3.5-turbo';
    this.temperature = config.temperature ?? 0.2;
    this.maxTokens = config.maxTokens || 2000;
  }

  async invoke(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      // Extract text from response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }
  }
}
