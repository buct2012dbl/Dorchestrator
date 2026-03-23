import type { LLMProvider, StreamParams, StreamChunk, ModelCapabilities } from './provider.js';
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
export declare class AnthropicCompatibleProvider implements LLMProvider {
    name: string;
    models: string[];
    private client;
    private config;
    constructor(name: string, config: AnthropicCompatibleConfig);
    streamText(params: StreamParams): AsyncIterable<StreamChunk>;
    countTokens(text: string, _model: string): number;
    getCapabilities(_model: string): ModelCapabilities;
}
//# sourceMappingURL=anthropic-compatible-provider.d.ts.map