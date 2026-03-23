import { Ollama } from 'ollama';
export class OllamaProvider {
    name = 'ollama';
    models = [
        'codellama:13b',
        'codellama:34b',
        'deepseek-coder:6.7b',
        'deepseek-coder:33b',
        'mistral:7b',
        'mixtral:8x7b',
        'llama2:13b',
        'llama2:70b'
    ];
    client;
    constructor(baseUrl = 'http://localhost:11434') {
        this.client = new Ollama({ host: baseUrl });
    }
    async *streamText(params) {
        const messages = [];
        if (params.systemPrompt) {
            messages.push({ role: 'system', content: params.systemPrompt });
        }
        messages.push(...params.messages);
        const stream = await this.client.chat({
            model: params.model.replace('ollama/', ''),
            messages,
            stream: true,
            options: {
                temperature: params.temperature || 0.7,
                num_predict: params.maxTokens || 8000
            }
        });
        for await (const chunk of stream) {
            if (chunk.message?.content) {
                yield {
                    type: 'text',
                    content: chunk.message.content
                };
            }
            if (chunk.done) {
                yield { type: 'done' };
            }
        }
    }
    countTokens(text, _model) {
        // Ollama doesn't provide tokenizer, use approximation
        return Math.ceil(text.length / 4);
    }
    getCapabilities(model) {
        // Most local models have smaller context windows
        let maxContextWindow = 4096;
        if (model.includes('34b') || model.includes('70b')) {
            maxContextWindow = 8192;
        }
        return {
            maxContextWindow,
            supportsTools: false, // Most local models don't support function calling
            supportsStreaming: true,
            supportsVision: false
        };
    }
    async listModels() {
        const response = await this.client.list();
        return response.models.map(m => m.name);
    }
}
//# sourceMappingURL=ollama.js.map