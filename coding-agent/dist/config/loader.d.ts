import { type Config } from './schema.js';
export declare class ConfigLoader {
    private config;
    load(configPath?: string): Promise<Config>;
    private substituteEnvVars;
    get(): Config;
    getAgent(id: string): {
        systemPrompt: string;
        tools: string[];
        id: string;
        type: string;
        temperature: number;
        name: string;
        model: string;
        maxTokens: number;
        description: string;
        contextWindow: number;
        permissions: {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        };
        provider?: string | undefined;
    } | undefined;
    getProviderConfig(provider: string): {
        type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
        apiKey?: string | undefined;
        headers?: Record<string, string> | undefined;
        baseUrl?: string | undefined;
        models?: string[] | undefined;
        defaultParams?: {
            temperature?: number | undefined;
            maxTokens?: number | undefined;
        } | undefined;
        apiVersion?: string | undefined;
        deployment?: string | undefined;
    } | undefined;
    resolveModelAlias(model: string): string;
    getFallbackChain(): string[];
    getApiKey(provider: string): string | undefined;
}
export declare const configLoader: ConfigLoader;
//# sourceMappingURL=loader.d.ts.map