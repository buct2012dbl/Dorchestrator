export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: string;
    }>;
    toolCallId?: string;
    metadata?: Record<string, any>;
}
export interface ToolCall {
    id: string;
    tool: string;
    args: Record<string, any>;
    result?: any;
    error?: string;
}
export interface ContextWindow {
    systemPrompt: string;
    task: string;
    files: ContextFile[];
    history: Message[];
    tools: any[];
    metadata: {
        totalTokens: number;
        budget: number;
        utilization: number;
    };
}
export interface ContextFile {
    path: string;
    content: string;
    priority: number;
    tokens: number;
    truncated?: boolean;
}
export interface Session {
    id: string;
    parentId?: string;
    agentId: string;
    messages: Message[];
    context: Partial<ContextWindow>;
    metadata: Record<string, any>;
    abort: AbortController;
    createdAt: number;
    updatedAt: number;
}
export declare class SessionManager {
    private sessions;
    private storage;
    create(agentId: string, parentId?: string): Session;
    get(id: string): Session | undefined;
    current(): Session;
    tryGetCurrent(): Session | undefined;
    provide<T>(session: Session, fn: () => T): T;
    provideAsync<T>(session: Session, fn: () => Promise<T>): Promise<T>;
    update(id: string, updates: Partial<Session>): void;
    addMessage(id: string, message: Message): void;
    delete(id: string): void;
    getChildren(parentId: string): Session[];
    clear(): void;
    getAll(): Session[];
    getStats(): {
        total: number;
        active: number;
        byAgent: Record<string, number>;
    };
    private groupByAgent;
}
export declare const sessionManager: SessionManager;
//# sourceMappingURL=session.d.ts.map