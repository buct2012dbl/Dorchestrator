import type { Tool } from './tool-registry.js';
export interface McpRegistrationResult {
    toolIds: string[];
    dispose(): void;
}
declare function getMcpToolId(serverName: string, toolName: string): string;
export declare function registerMcpToolsFromEnvironment(register: (tool: Tool) => void): Promise<McpRegistrationResult>;
export { getMcpToolId };
//# sourceMappingURL=mcp-tools.d.ts.map