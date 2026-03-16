import { randomUUID } from 'node:crypto';
import { BaseAgent } from './base-agent.js';
import type { AgentConfig } from '../core/agent-registry.js';
import { sessionManager } from '../core/session.js';
import { messageBus } from '../core/message-bus.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { selectProvider, executeWithFallback } from './provider-utils.js';
import chalk from 'chalk';
import ora from 'ora';

export class CodingAgent extends BaseAgent {
  constructor(config: AgentConfig) {
    super(config);
  }

  async process(message: string): Promise<string> {
    const session = sessionManager.current();

    // Add user message to session
    sessionManager.addMessage(session.id, {
      id: randomUUID(),
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

    // Get tools in provider format
    const tools = this.getTools();
    const toolsFormatted = provider.name === 'anthropic'
      ? toolRegistry.toAnthropicFormat(tools)
      : toolRegistry.toOpenAIFormat(tools);

    // Execute with automatic fallback on error
    let fullResponse = '';
    let continueLoop = true;
    let loopCount = 0;
    const maxLoops = 5; // Prevent infinite loops

    while (continueLoop && loopCount < maxLoops) {
      loopCount++;
      continueLoop = false;
      const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];
      let currentToolCall: { id: string; name: string; arguments: string } | null = null;

      await executeWithFallback(provider, resolvedModel, async (activeProvider) => {
        const stream = activeProvider.streamText({
          model: resolvedModel,
          messages: session.messages as any,
          tools: toolsFormatted as any,
          systemPrompt: this.config.systemPrompt,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text' && chunk.content) {
            fullResponse += chunk.content;
            process.stdout.write(chunk.content);
          } else if (chunk.type === 'tool_call' && chunk.toolCall) {
            // Accumulate tool call data
            if (!currentToolCall || currentToolCall.id !== chunk.toolCall.id) {
              if (currentToolCall) {
                toolCalls.push(currentToolCall);
              }
              currentToolCall = {
                id: chunk.toolCall.id,
                name: chunk.toolCall.name,
                arguments: chunk.toolCall.arguments
              };
            } else {
              currentToolCall.arguments += chunk.toolCall.arguments;
            }
          }
        }

        // Add final tool call if exists
        if (currentToolCall) {
          toolCalls.push(currentToolCall);
        }

        return fullResponse;
      });

      // Execute tool calls and continue loop if any were made
      if (toolCalls.length > 0) {
        const loopInfo = chalk.dim(`[Loop ${loopCount}/${maxLoops}]`);
        console.log(`\n${loopInfo} ${chalk.cyan(`${toolCalls.length} tool call(s) to execute`)}`);
        continueLoop = true;

        // Add assistant message with tool calls
        sessionManager.addMessage(session.id, {
          id: randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          toolCalls: toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            arguments: tc.arguments
          }))
        });

        // Execute each tool call and add results
        for (const toolCall of toolCalls) {
          const spinner = ora({
            text: chalk.dim(`Executing ${chalk.bold(toolCall.name)}...`),
            color: 'yellow'
          }).start();

          try {
            const result = await this.executeToolCall(
              toolCall.name,
              JSON.parse(toolCall.arguments)
            );

            spinner.succeed(chalk.dim(`${chalk.bold(toolCall.name)} completed`));

            // Add tool result message
            sessionManager.addMessage(session.id, {
              id: randomUUID(),
              role: 'tool',
              content: JSON.stringify(result),
              timestamp: Date.now(),
              toolCallId: toolCall.id
            });
          } catch (error) {
            spinner.fail(chalk.red(`${chalk.bold(toolCall.name)} failed: ${error}`));
            // Add error as tool result
            sessionManager.addMessage(session.id, {
              id: randomUUID(),
              role: 'tool',
              content: JSON.stringify({ error: String(error) }),
              timestamp: Date.now(),
              toolCallId: toolCall.id
            });
          }
        }

        // Show thinking indicator for next loop
        if (continueLoop && loopCount < maxLoops) {
          const thinkSpinner = ora({
            text: chalk.dim('Processing results...'),
            color: 'cyan'
          }).start();
          // Small delay to show the spinner
          await new Promise(resolve => setTimeout(resolve, 100));
          thinkSpinner.stop();
        }
      }
    }

    if (loopCount >= maxLoops) {
      console.log(chalk.yellow(`\n⚠️  Reached maximum loop count (${maxLoops}), stopping`));
    }

    if (!fullResponse) {
      console.log(chalk.yellow('\n⚠️  No response content received from model'));
    }

    // Add assistant message to session
    sessionManager.addMessage(session.id, {
      id: randomUUID(),
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
