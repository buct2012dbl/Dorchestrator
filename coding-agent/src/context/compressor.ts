import type { Message } from '../core/session.js';
import { tokenCounter } from '../llm/token-counter.js';
import type { LLMProvider } from '../llm/provider.js';

export class HistoryCompressor {
  constructor(_summarizer?: LLMProvider) {}

  async compress(messages: Message[], budget: number): Promise<Message[]> {
    // Strategy 1: Keep recent messages in full
    const recentCount = 5;
    const recent = messages.slice(-recentCount);
    const recentTokens = this.countTokens(recent);

    if (recentTokens <= budget) {
      // Enough budget, try to include more
      const older = messages.slice(0, -recentCount);
      const compressed = await this.compressOlder(older, budget - recentTokens);
      return [...compressed, ...recent];
    } else {
      // Not enough budget, truncate recent messages
      return this.truncateMessages(recent, budget);
    }
  }

  private async compressOlder(messages: Message[], budget: number): Promise<Message[]> {
    const compressed: Message[] = [];
    let usedTokens = 0;

    for (const message of messages) {
      const tokens = tokenCounter.estimateTokens(JSON.stringify(message));

      if (tokens <= 1000) {
        // Small message, keep as-is
        if (usedTokens + tokens <= budget) {
          compressed.push(message);
          usedTokens += tokens;
        }
      } else {
        // Large message, summarize or truncate
        const summary = await this.summarizeMessage(message, 500);
        const summaryTokens = tokenCounter.estimateTokens(JSON.stringify(summary));

        if (usedTokens + summaryTokens <= budget) {
          compressed.push(summary);
          usedTokens += summaryTokens;
        }
      }
    }

    return compressed;
  }

  private async summarizeMessage(message: Message, maxTokens: number): Promise<Message> {
    if (message.role === 'user') {
      // Keep user messages mostly intact
      return {
        ...message,
        content: this.truncateText(message.content, maxTokens)
      };
    }

    if (message.role === 'assistant' && message.toolCalls) {
      // Keep tool calls, summarize text
      return {
        ...message,
        content: this.truncateText(message.content, maxTokens / 2),
        toolCalls: message.toolCalls.map(tc => ({
          ...tc,
          arguments: this.truncateText(tc.arguments, maxTokens / 2)
        }))
      };
    }

    // For now, just truncate (LLM summarization can be added later)
    return {
      ...message,
      content: this.truncateText(message.content, maxTokens),
      metadata: { ...message.metadata, summarized: true }
    };
  }

  private truncateText(text: string, maxTokens: number): string {
    const tokens = tokenCounter.estimateTokens(text);
    if (tokens <= maxTokens) return text;

    // Rough approximation: 1 token ≈ 4 characters
    const maxChars = maxTokens * 4;
    return text.slice(0, maxChars) + '... [truncated]';
  }

  private truncateMessages(messages: Message[], budget: number): Message[] {
    const result: Message[] = [];
    let usedTokens = 0;

    // Start from most recent
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const tokens = tokenCounter.estimateTokens(JSON.stringify(message));

      if (usedTokens + tokens <= budget) {
        result.unshift(message);
        usedTokens += tokens;
      } else {
        // Truncate this message to fit
        const remaining = budget - usedTokens;
        if (remaining > 100) {
          const truncated = {
            ...message,
            content: this.truncateText(message.content, remaining)
          };
          result.unshift(truncated);
        }
        break;
      }
    }

    return result;
  }

  private countTokens(messages: Message[]): number {
    return messages.reduce((sum, msg) => {
      return sum + tokenCounter.estimateTokens(JSON.stringify(msg));
    }, 0);
  }
}
