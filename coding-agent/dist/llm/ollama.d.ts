import type { LLMProvider, StreamChunk, StreamParams, ModelCapabilities } from './provider.js';
export declare class OllamaProvider implements LLMProvider {
    name: string;
    models: string[];
    private client;
    constructor(baseUrl?: string);
    streamText(params: StreamParams): AsyncIterable<StreamChunk>;
    countTokens(text: string, _model: string): number;
    getCapabilities(model: string): ModelCapabilities;
    listModels(): Promise<string[]>;
}
//# sourceMappingURL=ollama.d.ts.map