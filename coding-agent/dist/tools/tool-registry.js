export class ToolRegistry {
    tools = new Map();
    register(tool) {
        this.tools.set(tool.id, tool);
    }
    get(id) {
        return this.tools.get(id);
    }
    getForAgent(_agentId, allowedTools) {
        return allowedTools
            .map(id => this.tools.get(id))
            .filter((tool) => tool !== undefined);
    }
    async execute(toolId, args, context) {
        const tool = this.tools.get(toolId);
        if (!tool) {
            return {
                success: false,
                error: `Tool ${toolId} not found`
            };
        }
        try {
            return await tool.execute(args, context);
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    getAll() {
        return Array.from(this.tools.values());
    }
    has(id) {
        return this.tools.has(id);
    }
    clear() {
        this.tools.clear();
    }
    toAnthropicFormat(tools) {
        return tools.map(tool => ({
            name: tool.id,
            description: tool.description,
            input_schema: tool.parameters
        }));
    }
    toOpenAIFormat(tools) {
        return tools.map(tool => ({
            type: 'function',
            function: {
                name: tool.id,
                description: tool.description,
                parameters: tool.parameters
            }
        }));
    }
}
export const toolRegistry = new ToolRegistry();
//# sourceMappingURL=tool-registry.js.map