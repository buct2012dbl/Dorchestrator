import { providerRegistry } from '../llm/provider.js';
import { configLoader } from '../config/loader.js';
import { logger } from '../monitoring/logger.js';
import { metrics } from '../monitoring/metrics.js';
/**
 * Select the best provider for a given model and optional explicit provider
 */
export function selectProvider(model, explicitProvider) {
    // Resolve model alias
    const resolvedModel = configLoader.resolveModelAlias(model);
    if (resolvedModel !== model) {
        logger.debug('Model alias resolved', {
            alias: model,
            resolved: resolvedModel
        });
    }
    // Get LLM provider - use explicit provider if specified, otherwise detect
    let provider = explicitProvider
        ? providerRegistry.get(explicitProvider)
        : providerRegistry.detectProvider(resolvedModel);
    let providerSource = 'explicit';
    if (!explicitProvider) {
        providerSource = provider ? 'detected' : 'fallback';
    }
    if (!provider) {
        // Try fallback chain
        const fallbackChain = configLoader.getFallbackChain();
        logger.info('Primary provider not found, trying fallback chain', {
            model: resolvedModel,
            fallbackChain
        });
        for (const providerName of fallbackChain) {
            provider = providerRegistry.get(providerName);
            if (provider) {
                logger.info('Fallback provider selected', {
                    provider: providerName,
                    model: resolvedModel
                });
                metrics.increment('provider.fallback.success', 1, {
                    provider: providerName,
                    model: resolvedModel
                });
                break;
            }
        }
    }
    if (!provider) {
        const error = `No provider available for model: ${resolvedModel}`;
        logger.error(error, {
            model: resolvedModel,
            configuredProvider: explicitProvider,
            fallbackChain: configLoader.getFallbackChain()
        });
        metrics.increment('provider.selection.failed', 1, {
            model: resolvedModel
        });
        throw new Error(error);
    }
    logger.info('Provider selected', {
        provider: provider.name,
        model: resolvedModel,
        source: providerSource
    });
    metrics.increment('provider.selection.success', 1, {
        provider: provider.name,
        model: resolvedModel,
        source: providerSource
    });
    return {
        provider,
        resolvedModel,
        source: providerSource
    };
}
/**
 * Execute LLM request with automatic fallback on error
 */
export async function executeWithFallback(provider, resolvedModel, fn) {
    const startTime = Date.now();
    try {
        const result = await fn(provider);
        const duration = Date.now() - startTime;
        logger.info('LLM request completed', {
            provider: provider.name,
            model: resolvedModel,
            duration
        });
        metrics.timing('llm.request.duration', duration, {
            provider: provider.name,
            model: resolvedModel,
            success: 'true'
        });
        return result;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        logger.error('LLM request failed', {
            provider: provider.name,
            model: resolvedModel,
            duration,
            error: error instanceof Error ? error.message : String(error)
        });
        metrics.timing('llm.request.duration', duration, {
            provider: provider.name,
            model: resolvedModel,
            success: 'false'
        });
        metrics.increment('llm.request.failed', 1, {
            provider: provider.name,
            model: resolvedModel
        });
        // Try fallback chain if available
        const fallbackChain = configLoader.getFallbackChain();
        const currentProviderIndex = fallbackChain.indexOf(provider.name);
        const remainingProviders = fallbackChain.slice(currentProviderIndex + 1);
        if (remainingProviders.length > 0) {
            logger.info('Attempting fallback providers', {
                failed: provider.name,
                remaining: remainingProviders
            });
            for (const fallbackName of remainingProviders) {
                const fallbackProvider = providerRegistry.get(fallbackName);
                if (!fallbackProvider)
                    continue;
                try {
                    logger.info('Trying fallback provider', { provider: fallbackName });
                    const fallbackStartTime = Date.now();
                    const result = await fn(fallbackProvider);
                    const fallbackDuration = Date.now() - fallbackStartTime;
                    logger.info('Fallback provider succeeded', {
                        provider: fallbackName,
                        duration: fallbackDuration
                    });
                    metrics.timing('llm.request.duration', fallbackDuration, {
                        provider: fallbackName,
                        model: resolvedModel,
                        success: 'true'
                    });
                    metrics.increment('provider.fallback.used', 1, {
                        original: provider.name,
                        fallback: fallbackName
                    });
                    return result;
                }
                catch (fallbackError) {
                    logger.warn('Fallback provider failed', {
                        provider: fallbackName,
                        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
                    });
                    metrics.increment('provider.fallback.failed', 1, {
                        provider: fallbackName
                    });
                    continue;
                }
            }
            // All fallbacks failed
            throw new Error(`All providers failed. Original error: ${error instanceof Error ? error.message : String(error)}`);
        }
        else {
            // No fallback available, re-throw original error
            throw error;
        }
    }
}
//# sourceMappingURL=provider-utils.js.map