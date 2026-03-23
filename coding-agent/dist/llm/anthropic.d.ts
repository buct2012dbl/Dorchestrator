import type { LLMProvider, StreamChunk, StreamParams, ModelCapabilities } from './provider.js';
export declare class AnthropicProvider implements LLMProvider {
    name: string;
    models: string[];
    private client;
    constructor(apiKey: string);
    streamText(params: StreamParams): AsyncIterable<StreamChunk>;
    countTokens(text: string, _model: string): number;
    getCapabilities(model: string): ModelCapabilities;
}
//# sourceMappingURL=anthropic.d.ts.map