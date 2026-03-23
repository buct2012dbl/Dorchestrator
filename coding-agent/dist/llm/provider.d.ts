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
export declare class ProviderRegistry {
    private providers;
    register(provider: LLMProvider): void;
    get(name: string): LLMProvider | undefined;
    detectProvider(model: string): LLMProvider | undefined;
    static createFromConfig(name: string, config: any): LLMProvider;
    loadFromConfig(config: any): void;
    streamWithFallback(providerNames: string[], params: StreamParams): AsyncIterable<StreamChunk>;
    getAll(): LLMProvider[];
    clear(): void;
}
export declare const providerRegistry: ProviderRegistry;
//# sourceMappingURL=provider.d.ts.map