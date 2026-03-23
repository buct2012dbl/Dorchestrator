import type { LLMProvider, StreamParams, StreamChunk, ModelCapabilities } from './provider.js';
export interface GenericProviderConfig {
    apiKey?: string;
    baseUrl?: string;
    models?: string[];
    headers?: Record<string, string>;
    defaultParams?: {
        temperature?: number;
        maxTokens?: number;
    };
}
export declare class GenericProvider implements LLMProvider {
    name: string;
    models: string[];
    private client;
    private config;
    constructor(name: string, config: GenericProviderConfig);
    streamText(params: StreamParams): AsyncIterable<StreamChunk>;
    countTokens(text: string, _model: string): number;
    getCapabilities(model: string): ModelCapabilities;
}
//# sourceMappingURL=generic-provider.d.ts.map