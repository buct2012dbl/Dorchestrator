import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';
import { GenericProvider } from './generic-provider.js';
import { AnthropicCompatibleProvider } from './anthropic-compatible-provider.js';
export class ProviderRegistry {
    providers = new Map();
    register(provider) {
        this.providers.set(provider.name, provider);
    }
    get(name) {
        return this.providers.get(name);
    }
    detectProvider(model) {
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
    static createFromConfig(name, config) {
        switch (config.type) {
            case 'anthropic':
                return new AnthropicProvider(config.apiKey);
            case 'openai':
                return new OpenAIProvider(config.apiKey);
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
    loadFromConfig(config) {
        if (!config.llm?.providers)
            return;
        for (const [name, providerConfig] of Object.entries(config.llm.providers)) {
            try {
                const provider = ProviderRegistry.createFromConfig(name, providerConfig);
                this.register(provider);
            }
            catch (error) {
                console.warn(`Failed to load provider ${name}:`, error);
            }
        }
    }
    async *streamWithFallback(providerNames, params) {
        let lastError;
        for (const providerName of providerNames) {
            const provider = this.providers.get(providerName);
            if (!provider)
                continue;
            try {
                yield* provider.streamText(params);
                return; // Success, exit
            }
            catch (error) {
                lastError = error;
                console.warn(`Provider ${providerName} failed, trying next...`);
                continue;
            }
        }
        throw new Error(`All providers failed. Last error: ${lastError?.message || 'Unknown'}`);
    }
    getAll() {
        return Array.from(this.providers.values());
    }
    clear() {
        this.providers.clear();
    }
}
export const providerRegistry = new ProviderRegistry();
//# sourceMappingURL=provider.js.map