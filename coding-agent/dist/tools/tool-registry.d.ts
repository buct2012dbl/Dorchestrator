export interface ToolContext {
    sessionId: string;
    agentId: string;
    workingDirectory: string;
}
export interface ToolResult {
    success: boolean;
    data?: any;
    error?: string;
}
export interface Tool {
    id: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
    execute(args: any, context: ToolContext): Promise<ToolResult>;
}
export declare class ToolRegistry {
    private tools;
    register(tool: Tool): void;
    get(id: string): Tool | undefined;
    getForAgent(_agentId: string, allowedTools: string[]): Tool[];
    execute(toolId: string, args: any, context: ToolContext): Promise<ToolResult>;
    getAll(): Tool[];
    has(id: string): boolean;
    clear(): void;
    toAnthropicFormat(tools: Tool[]): {
        name: string;
        description: string;
        input_schema: {
            type: "object";
            properties: Record<string, any>;
            required?: string[];
        };
    }[];
    toOpenAIFormat(tools: Tool[]): {
        type: string;
        function: {
            name: string;
            description: string;
            parameters: {
                type: "object";
                properties: Record<string, any>;
                required?: string[];
            };
        };
    }[];
}
export declare const toolRegistry: ToolRegistry;
//# sourceMappingURL=tool-registry.d.ts.map