import OpenAI from 'openai';
import { logger } from '../monitoring/logger.js';
export class GenericProvider {
    name;
    models;
    client;
    config;
    constructor(name, config) {
        this.name = name;
        this.models = config.models || [];
        this.config = config;
        this.client = new OpenAI({
            apiKey: config.apiKey || 'dummy-key',
            baseURL: config.baseUrl,
            defaultHeaders: config.headers
        });
        logger.info('Generic provider initialized', {
            name,
            baseUrl: config.baseUrl,
            modelCount: this.models.length
        });
    }
    async *streamText(params) {
        try {
            // Prepare messages with system prompt if provided
            let messages = params.systemPrompt
                ? [{ role: 'system', content: params.systemPrompt }, ...params.messages]
                : params.messages;
            // Convert messages to OpenAI format, handling tool calls and tool results
            messages = messages.map(msg => {
                if (msg.role === 'tool') {
                    // Tool result message
                    return {
                        role: 'tool',
                        content: msg.content,
                        tool_call_id: msg.toolCallId
                    };
                }
                else if (msg.role === 'assistant' && msg.toolCalls) {
                    // Assistant message with tool calls
                    return {
                        role: 'assistant',
                        content: msg.content || null,
                        tool_calls: msg.toolCalls.map((tc) => ({
                            id: tc.id,
                            type: 'function',
                            function: {
                                name: tc.name,
                                arguments: tc.arguments
                            }
                        }))
                    };
                }
                else {
                    // Regular message
                    return {
                        role: msg.role,
                        content: msg.content
                    };
                }
            });
            logger.debug('Sending request to provider', {
                provider: this.name,
                model: params.model,
                messageCount: messages.length,
                hasTools: !!params.tools,
                toolCount: params.tools?.length || 0,
                temperature: params.temperature ?? this.config.defaultParams?.temperature,
                maxTokens: params.maxTokens ?? this.config.defaultParams?.maxTokens
            });
            const requestParams = {
                model: params.model,
                messages: messages,
                temperature: params.temperature ?? this.config.defaultParams?.temperature,
                max_tokens: params.maxTokens ?? this.config.defaultParams?.maxTokens,
                stream: true
            };
            // Only add tools if they exist and are not empty
            if (params.tools && params.tools.length > 0) {
                requestParams.tools = params.tools;
            }
            const stream = await this.client.chat.completions.create(requestParams);
            let chunkCount = 0;
            let hasReceivedContent = false;
            for await (const chunk of stream) {
                chunkCount++;
                const delta = chunk.choices[0]?.delta;
                // Log all chunks for debugging
                logger.info('Received chunk', {
                    provider: this.name,
                    chunkNumber: chunkCount,
                    hasContent: !!delta?.content,
                    hasReasoningContent: !!delta?.reasoning_content,
                    hasToolCalls: !!delta?.tool_calls,
                    finishReason: chunk.choices[0]?.finish_reason,
                    fullChunk: JSON.stringify(chunk),
                    deltaKeys: delta ? Object.keys(delta) : []
                });
                // Handle both content and reasoning_content fields
                const content = delta?.content || delta?.reasoning_content;
                if (content) {
                    hasReceivedContent = true;
                    yield {
                        type: 'text',
                        content: content
                    };
                }
                if (delta?.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        // Yield tool call chunks - the agent will accumulate them
                        yield {
                            type: 'tool_call',
                            toolCall: {
                                id: toolCall.id || '',
                                name: toolCall.function?.name || '',
                                arguments: toolCall.function?.arguments || ''
                            }
                        };
                    }
                }
                // Check for finish reason
                if (chunk.choices[0]?.finish_reason) {
                    logger.info('Stream finished', {
                        provider: this.name,
                        finishReason: chunk.choices[0].finish_reason,
                        totalChunks: chunkCount,
                        hasReceivedContent
                    });
                }
            }
            logger.info('Stream loop completed', {
                provider: this.name,
                totalChunks: chunkCount,
                hasReceivedContent
            });
            // Don't warn if no content but we have tool calls - that's expected
            // The warning is only useful if we got neither content nor tool calls
            yield { type: 'done' };
        }
        catch (error) {
            logger.error('Generic provider stream error', {
                provider: this.name,
                model: params.model,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    countTokens(text, _model) {
        // Rough approximation: 1 token ≈ 4 characters
        return Math.ceil(text.length / 4);
    }
    getCapabilities(model) {
        // Default capabilities for OpenAI-compatible APIs
        return {
            maxContextWindow: 128000,
            supportsTools: true,
            supportsStreaming: true,
            supportsVision: model.includes('vision') || model.includes('gpt-4')
        };
    }
}
//# sourceMappingURL=generic-provider.js.map