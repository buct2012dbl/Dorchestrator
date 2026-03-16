import { encodingForModel, type TiktokenModel } from 'js-tiktoken';

export class TokenCounter {
  private encoders = new Map<string, any>();

  count(text: string, model: string = 'gpt-4'): number {
    try {
      const encoder = this.getEncoder(model);
      const tokens = encoder.encode(text);
      return tokens.length;
    } catch (error) {
      // Fallback: rough approximation (1 token ≈ 4 characters)
      return Math.ceil(text.length / 4);
    }
  }

  countMessages(messages: Array<{ role: string; content: string }>, model: string = 'gpt-4'): number {
    let total = 0;

    for (const message of messages) {
      // Add tokens for message structure
      total += 4; // Every message has role, content, and formatting tokens

      total += this.count(message.role, model);
      total += this.count(message.content, model);
    }

    total += 2; // Add tokens for priming

    return total;
  }

  private getEncoder(model: string): any {
    if (this.encoders.has(model)) {
      return this.encoders.get(model);
    }

    try {
      // Map model names to tiktoken models
      const tiktokenModel = this.mapModelToTiktoken(model);
      const encoder = encodingForModel(tiktokenModel);
      this.encoders.set(model, encoder);
      return encoder;
    } catch (error) {
      // Fallback to gpt-4 encoding
      const encoder = encodingForModel('gpt-4');
      this.encoders.set(model, encoder);
      return encoder;
    }
  }

  private mapModelToTiktoken(model: string): TiktokenModel {
    // Claude models use similar tokenization to GPT-4
    if (model.includes('claude')) return 'gpt-4';
    if (model.includes('gpt-4')) return 'gpt-4';
    if (model.includes('gpt-3.5')) return 'gpt-3.5-turbo';
    if (model.includes('gemini')) return 'gpt-4';

    return 'gpt-4'; // Default fallback
  }

  estimateTokens(text: string): number {
    // Fast estimation without encoding
    return Math.ceil(text.length / 4);
  }

  clear(): void {
    for (const encoder of this.encoders.values()) {
      encoder.free();
    }
    this.encoders.clear();
  }
}

export const tokenCounter = new TokenCounter();
