import { BaseAgent } from './base-agent.js';
import { sessionManager } from '../core/session.js';
import { messageBus } from '../core/message-bus.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { selectProvider, executeWithFallback } from './provider-utils.js';
export class PlannerAgent extends BaseAgent {
    constructor(config) {
        super(config);
    }
    async process(message) {
        const session = sessionManager.current();
        sessionManager.addMessage(session.id, {
            id: crypto.randomUUID(),
            role: 'user',
            content: message,
            timestamp: Date.now()
        });
        await messageBus.publish('agent:message', { message }, {
            sessionId: session.id,
            agentId: this.config.id
        });
        const { provider, resolvedModel } = selectProvider(this.config.model, this.config.provider);
        const tools = this.getTools();
        const toolsFormatted = provider.name === 'anthropic'
            ? toolRegistry.toAnthropicFormat(tools)
            : toolRegistry.toOpenAIFormat(tools);
        let fullResponse = '';
        await executeWithFallback(provider, resolvedModel, async (activeProvider) => {
            const stream = activeProvider.streamText({
                model: resolvedModel,
                messages: session.messages.map(m => ({
                    role: m.role,
                    content: m.content
                })),
                tools: toolsFormatted,
                systemPrompt: this.config.systemPrompt,
                temperature: this.config.temperature,
                maxTokens: this.config.maxTokens
            });
            fullResponse = '';
            for await (const chunk of stream) {
                if (chunk.type === 'text' && chunk.content) {
                    fullResponse += chunk.content;
                }
                else if (chunk.type === 'tool_call' && chunk.toolCall) {
                    await this.executeToolCall(chunk.toolCall.name, JSON.parse(chunk.toolCall.arguments));
                    fullResponse += `\n[Tool: ${chunk.toolCall.name}]\n`;
                }
            }
            return fullResponse;
        });
        sessionManager.addMessage(session.id, {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: fullResponse,
            timestamp: Date.now()
        });
        await messageBus.publish('agent:response', { response: fullResponse }, {
            sessionId: session.id,
            agentId: this.config.id
        });
        return fullResponse;
    }
}
//# sourceMappingURL=planner-agent.js.map