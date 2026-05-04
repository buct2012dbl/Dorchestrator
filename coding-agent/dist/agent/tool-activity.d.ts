export interface ToolLifecycleEvent {
    kind: 'assistant' | 'command' | 'error' | 'tool';
    phase?: 'running' | 'completed';
    title: string;
    text?: string;
    toolName?: string;
    toolState?: 'queued' | 'running' | 'completed' | 'failed';
    summary?: string;
}
export declare function summarizeToolCall(toolName: string, args: Record<string, unknown>): string;
export declare function summarizeToolResult(result: unknown): string;
export declare function createQueuedToolEvent(toolName: string, args: Record<string, unknown>): ToolLifecycleEvent;
export declare function createRunningToolEvent(toolName: string, args: Record<string, unknown>): ToolLifecycleEvent;
export declare function createCompletedToolEvent(toolName: string, result: unknown): ToolLifecycleEvent;
export declare function createFailedToolEvent(toolName: string, error: unknown): ToolLifecycleEvent;
//# sourceMappingURL=tool-activity.d.ts.map