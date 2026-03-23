import type { LLMProvider } from '../llm/provider.js';
export interface ProviderSelectionResult {
    provider: LLMProvider;
    resolvedModel: string;
    source: 'explicit' | 'detected' | 'fallback';
}
/**
 * Select the best provider for a given model and optional explicit provider
 */
export declare function selectProvider(model: string, explicitProvider?: string): ProviderSelectionResult;
/**
 * Execute LLM request with automatic fallback on error
 */
export declare function executeWithFallback<T>(provider: LLMProvider, resolvedModel: string, fn: (provider: LLMProvider) => Promise<T>): Promise<T>;
//# sourceMappingURL=provider-utils.d.ts.map