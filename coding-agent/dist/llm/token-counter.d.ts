export declare class TokenCounter {
    private encoders;
    count(text: string, model?: string): number;
    countMessages(messages: Array<{
        role: string;
        content: string;
    }>, model?: string): number;
    private getEncoder;
    private mapModelToTiktoken;
    estimateTokens(text: string): number;
    clear(): void;
}
export declare const tokenCounter: TokenCounter;
//# sourceMappingURL=token-counter.d.ts.map