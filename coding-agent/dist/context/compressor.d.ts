import type { Message } from '../core/session.js';
import type { LLMProvider } from '../llm/provider.js';
export declare class HistoryCompressor {
    constructor(_summarizer?: LLMProvider);
    compress(messages: Message[], budget: number): Promise<Message[]>;
    private compressOlder;
    private summarizeMessage;
    private truncateText;
    private truncateMessages;
    private countTokens;
}
//# sourceMappingURL=compressor.d.ts.map