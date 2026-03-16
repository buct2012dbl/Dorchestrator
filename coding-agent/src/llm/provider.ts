import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { GenericProvider } from './generic-provider.js';
import { AnthropicCompatibleProvider } from './anthropic-compatible-provider.js';

export interface StreamChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCall?: {
    id: string;
    name: string;
    arguments: string;
  };
  toolResult?: {
    id: string;
    result: any;
  };
  error?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: any;
}

export interface StreamParams {
  model: string;
  messages: Message[];
  tools?: Tool[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ModelCapabilities {
  maxContextWindow: number;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
}

export interface LLMProvider {
  name: string;
  models: string[];

  streamText(params: StreamParams): AsyncIterable<StreamChunk>;
  countTokens(text: string, model: string): number;
  getCapabilities(model: string): ModelCapabilities;
}

export class ProviderRegistry {
  private providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  detectProvider(model: string): LLMProvider | undefined {
    // First, check if any provider explicitly supports this model
    for (const provider of this.providers.values()) {
      if (provider.models.includes(model)) {
        return provider;
      }
    }

    // Fall back to detecting provider from model name patterns
    if (model.includes('claude')) {
      return this.providers.get('anthropic');
    }
    if (model.includes('gpt')) {
      return this.providers.get('openai');
    }
    if (model.includes('gemini')) {
      return this.providers.get('google');
    }
    if (model.includes('ollama/')) {
      return this.providers.get('ollama');
    }

    return undefined;
  }

  static createFromConfig(name: string, config: any): LLMProvider {
    switch (config.type) {
      case 'anthropic':
        return new AnthropicProvider(config.apiKey!);

      case 'openai':
        return new OpenAIProvider(config.apiKey!);

      case 'ollama':
        return new OllamaProvider(config.baseUrl || 'http://localhost:11434');

      case 'openai-compatible':
        return new GenericProvider(name, config);

      case 'anthropic-compatible':
        return new AnthropicCompatibleProvider(name, config);

      case 'azure-openai':
        // For now, treat Azure as OpenAI-compatible with custom base URL
        return new GenericProvider(name, config);

      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }
  }

  loadFromConfig(config: any): void {
    if (!config.llm?.providers) return;

    for (const [name, providerConfig] of Object.entries(config.llm.providers)) {
      try {
        const provider = ProviderRegistry.createFromConfig(name, providerConfig);
        this.register(provider);
      } catch (error) {
        console.warn(`Failed to load provider ${name}:`, error);
      }
    }
  }

  async *streamWithFallback(
    providerNames: string[],
    params: StreamParams
  ): AsyncIterable<StreamChunk> {
    let lastError: Error | undefined;

    for (const providerName of providerNames) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;

      try {
        yield* provider.streamText(params);
        return; // Success, exit
      } catch (error) {
        lastError = error as Error;
        console.warn(`Provider ${providerName} failed, trying next...`);
        continue;
      }
    }

    throw new Error(
      `All providers failed. Last error: ${lastError?.message || 'Unknown'}`
    );
  }

  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  clear(): void {
    this.providers.clear();
  }
}

export const providerRegistry = new ProviderRegistry();
