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

export class AgentRegistry {
  private agents = new Map<string, AgentInstance>();
  private factories = new Map<string, (config: AgentConfig) => BaseAgent>();

  registerFactory(type: string, factory: (config: AgentConfig) => BaseAgent): void {
    this.factories.set(type, factory);
  }

  create(config: AgentConfig): BaseAgent {
    const factory = this.factories.get(config.type);
    if (!factory) {
      throw new Error(`No factory registered for agent type: ${config.type}`);
    }

    const agent = factory(config);
    const instance: AgentInstance = {
      agent,
      config,
      status: 'idle',
      createdAt: Date.now(),
      lastUsed: Date.now()
    };

    this.agents.set(config.id, instance);
    return agent;
  }

  get(id: string): BaseAgent | undefined {
    const instance = this.agents.get(id);
    if (instance) {
      instance.lastUsed = Date.now();
      return instance.agent;
    }
    return undefined;
  }

  getConfig(id: string): AgentConfig | undefined {
    return this.agents.get(id)?.config;
  }

  getStatus(id: string): AgentStatus | undefined {
    return this.agents.get(id)?.status;
  }

  setStatus(id: string, status: AgentStatus): void {
    const instance = this.agents.get(id);
    if (instance) {
      instance.status = status;
    }
  }

  delete(id: string): void {
    this.agents.delete(id);
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values()).map(i => i.agent);
  }

  getAllConfigs(): AgentConfig[] {
    return Array.from(this.agents.values()).map(i => i.config);
  }

  has(id: string): boolean {
    return this.agents.has(id);
  }

  clear(): void {
    this.agents.clear();
  }

  getStats() {
    const instances = Array.from(this.agents.values());
    return {
      total: instances.length,
      byType: this.groupByType(instances),
      byStatus: this.groupByStatus(instances)
    };
  }

  private groupByType(instances: AgentInstance[]): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const instance of instances) {
      groups[instance.config.type] = (groups[instance.config.type] || 0) + 1;
    }
    return groups;
  }

  private groupByStatus(instances: AgentInstance[]): Record<AgentStatus, number> {
    const groups: Record<AgentStatus, number> = {
      idle: 0,
      busy: 0,
      error: 0,
      stopped: 0
    };
    for (const instance of instances) {
      groups[instance.status]++;
    }
    return groups;
  }
}

export const agentRegistry = new AgentRegistry();
