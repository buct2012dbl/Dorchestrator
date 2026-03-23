import { tokenCounter } from '../llm/token-counter.js';
export class HistoryCompressor {
    constructor(_summarizer) { }
    async compress(messages, budget) {
        // Strategy 1: Keep recent messages in full
        const recentCount = 5;
        const recent = messages.slice(-recentCount);
        const recentTokens = this.countTokens(recent);
        if (recentTokens <= budget) {
            // Enough budget, try to include more
            const older = messages.slice(0, -recentCount);
            const compressed = await this.compressOlder(older, budget - recentTokens);
            return [...compressed, ...recent];
        }
        else {
            // Not enough budget, truncate recent messages
            return this.truncateMessages(recent, budget);
        }
    }
    async compressOlder(messages, budget) {
        const compressed = [];
        let usedTokens = 0;
        for (const message of messages) {
            const tokens = tokenCounter.estimateTokens(JSON.stringify(message));
            if (tokens <= 1000) {
                // Small message, keep as-is
                if (usedTokens + tokens <= budget) {
                    compressed.push(message);
                    usedTokens += tokens;
                }
            }
            else {
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
    async summarizeMessage(message, maxTokens) {
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
    truncateText(text, maxTokens) {
        const tokens = tokenCounter.estimateTokens(text);
        if (tokens <= maxTokens)
            return text;
        // Rough approximation: 1 token ≈ 4 characters
        const maxChars = maxTokens * 4;
        return text.slice(0, maxChars) + '... [truncated]';
    }
    truncateMessages(messages, budget) {
        const result = [];
        let usedTokens = 0;
        // Start from most recent
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            const tokens = tokenCounter.estimateTokens(JSON.stringify(message));
            if (usedTokens + tokens <= budget) {
                result.unshift(message);
                usedTokens += tokens;
            }
            else {
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
    countTokens(messages) {
        return messages.reduce((sum, msg) => {
            return sum + tokenCounter.estimateTokens(JSON.stringify(msg));
        }, 0);
    }
}
//# sourceMappingURL=compressor.js.map