import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, StreamParams, StreamChunk, ModelCapabilities } from './provider.js';
import { logger } from '../monitoring/logger.js';

export interface AnthropicCompatibleConfig {
  apiKey?: string;
  baseUrl?: string;
  models?: string[];
  headers?: Record<string, string>;
  defaultParams?: {
    temperature?: number;
    maxTokens?: number;
  };
  apiVersion?: string;
}

export class AnthropicCompatibleProvider implements LLMProvider {
  name: string;
  models: string[];
  private client: Anthropic;
  private config: AnthropicCompatibleConfig;

  constructor(name: string, config: AnthropicCompatibleConfig) {
    this.name = name;
    this.models = config.models || [];
    this.config = config;

    this.client = new Anthropic({
      apiKey: config.apiKey || 'dummy-key',
      baseURL: config.baseUrl,
      defaultHeaders: config.headers
    });

    logger.info('Anthropic-compatible provider initialized', {
      name,
      baseUrl: config.baseUrl,
      modelCount: this.models.length
    });
  }

  async *streamText(params: StreamParams): AsyncIterable<StreamChunk> {
    try {
      const stream = await this.client.messages.create({
        model: params.model,
        max_tokens: params.maxTokens ?? this.config.defaultParams?.maxTokens ?? 4096,
        temperature: params.temperature ?? this.config.defaultParams?.temperature,
        system: params.systemPrompt,
        messages: params.messages.map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content
        })),
        tools: params.tools as any,
        stream: true
      });

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          // Content block started
          continue;
        } else if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield {
              type: 'text',
              content: event.delta.text
            };
          }
        } else if (event.type === 'message_delta') {
          if (event.delta.stop_reason) {
            yield {
              type: 'done'
            };
          }
        }
      }
    } catch (error) {
      logger.error('Anthropic-compatible provider stream error', {
        provider: this.name,
        model: params.model,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  countTokens(text: string, _model: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  getCapabilities(_model: string): ModelCapabilities {
    return {
      maxContextWindow: 200000,
      supportsTools: true,
      supportsStreaming: true,
      supportsVision: false
    };
  }
}
