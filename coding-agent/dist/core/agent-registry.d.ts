import type { BaseAgent } from '../agent/base-agent.js';
export interface AgentConfig {
    id: string;
    type: string;
    name: string;
    description: string;
    systemPrompt: string;
    model: string;
    provider?: string;
    temperature: number;
    maxTokens: number;
    contextWindow: number;
    tools: string[];
    permissions: {
        fileWrite: boolean;
        shellExec: boolean;
        networkAccess: boolean;
    };
}
export type AgentStatus = 'idle' | 'busy' | 'error' | 'stopped';
export interface AgentInstance {
    agent: BaseAgent;
    config: AgentConfig;
    status: AgentStatus;
    createdAt: number;
    lastUsed: number;
}
export declare class AgentRegistry {
    private agents;
    private factories;
    registerFactory(type: string, factory: (config: AgentConfig) => BaseAgent): void;
    create(config: AgentConfig): BaseAgent;
    get(id: string): BaseAgent | undefined;
    getConfig(id: string): AgentConfig | undefined;
    getStatus(id: string): AgentStatus | undefined;
    setStatus(id: string, status: AgentStatus): void;
    delete(id: string): void;
    getAll(): BaseAgent[];
    getAllConfigs(): AgentConfig[];
    has(id: string): boolean;
    clear(): void;
    getStats(): {
        total: number;
        byType: Record<string, number>;
        byStatus: Record<AgentStatus, number>;
    };
    private groupByType;
    private groupByStatus;
}
export declare const agentRegistry: AgentRegistry;
//# sourceMappingURL=agent-registry.d.ts.map