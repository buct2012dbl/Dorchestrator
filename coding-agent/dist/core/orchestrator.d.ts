import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentConfig } from './agent-registry.js';
export interface OrchestratorConfig {
    workingDirectory: string;
    maxConcurrentAgents: number;
    defaultModel: string;
    defaultTemperature: number;
}
export declare class Orchestrator {
    private initialized;
    private activeSessions;
    constructor(_config: OrchestratorConfig);
    initialize(): Promise<void>;
    private setupEventListeners;
    createAgent(config: AgentConfig): BaseAgent;
    getAgent(id: string): BaseAgent | undefined;
    executeTask(agentId: string, task: string, onFirstText?: () => void): Promise<string>;
    endSession(agentId: string): void;
    executeParallel(tasks: Array<{
        agentId: string;
        task: string;
    }>): Promise<string[]>;
    getStats(): {
        agents: {
            total: number;
            byType: Record<string, number>;
            byStatus: Record<import("./agent-registry.js").AgentStatus, number>;
        };
        sessions: {
            total: number;
            active: number;
            byAgent: Record<string, number>;
        };
        events: {
            total: number;
        };
    };
    shutdown(): void;
}
//# sourceMappingURL=orchestrator.d.ts.map