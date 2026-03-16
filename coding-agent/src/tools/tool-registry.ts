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

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getForAgent(_agentId: string, allowedTools: string[]): Tool[] {
    return allowedTools
      .map(id => this.tools.get(id))
      .filter((tool): tool is Tool => tool !== undefined);
  }

  async execute(toolId: string, args: any, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolId} not found`
      };
    }

    try {
      return await tool.execute(args, context);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  clear(): void {
    this.tools.clear();
  }

  toAnthropicFormat(tools: Tool[]) {
    return tools.map(tool => ({
      name: tool.id,
      description: tool.description,
      input_schema: tool.parameters
    }));
  }

  toOpenAIFormat(tools: Tool[]) {
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
