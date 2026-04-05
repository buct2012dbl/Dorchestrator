import { BaseAgent } from './base-agent.js';
import type { AgentConfig } from '../core/agent-registry.js';
import { sessionManager } from '../core/session.js';
import { messageBus } from '../core/message-bus.js';
import { selectProvider, executeWithFallback, formatToolsForProvider } from './provider-utils.js';

export class ExplorerAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async process(message: string): Promise<string> {
    const session = sessionManager.current();

    // Add user message to session
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

    // Select provider with fallback support
    const { provider, resolvedModel } = selectProvider(
      this.config.model,
      this.config.provider
    );

    const tools = this.getTools();

    // Execute with automatic fallback on error
    let fullResponse = '';
    await executeWithFallback(provider, resolvedModel, async (activeProvider) => {
      const toolsFormatted = formatToolsForProvider(activeProvider, tools);
      const stream = activeProvider.streamText({
        model: resolvedModel,
        messages: session.messages.map(m => ({
          role: m.role as any,
          content: m.content
        })),
        tools: toolsFormatted as any,
        systemPrompt: this.config.systemPrompt,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens
      });

      fullResponse = '';
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.content) {
          fullResponse += chunk.content;
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          await this.executeToolCall(
            chunk.toolCall.name,
            JSON.parse(chunk.toolCall.arguments)
          );
          fullResponse += `\n[Tool: ${chunk.toolCall.name}]\n`;
        }
      }

      return fullResponse;
    });

    // Add assistant message to session
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
