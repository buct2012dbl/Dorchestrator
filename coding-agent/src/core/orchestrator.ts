import { sessionManager } from './session.js';
import { agentRegistry } from './agent-registry.js';
import { messageBus } from './message-bus.js';
import type { BaseAgent } from '../agent/base-agent.js';
import type { AgentConfig } from './agent-registry.js';

export interface OrchestratorConfig {
  workingDirectory: string;
  maxConcurrentAgents: number;
  defaultModel: string;
  defaultTemperature: number;
}

export class Orchestrator {
  private initialized = false;
  private activeSessions = new Map<string, string>(); // agentId -> sessionId

  constructor(_config: OrchestratorConfig) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Set up event listeners
    this.setupEventListeners();

    this.initialized = true;
  }

  private setupEventListeners(): void {
    messageBus.subscribe('agent:error', (data) => {
      console.error(`Agent error: ${data.agentId}`, data.error);
    });
  }

  createAgent(config: AgentConfig): BaseAgent {
    return agentRegistry.create(config);
  }

  getAgent(id: string): BaseAgent | undefined {
    return agentRegistry.get(id);
  }

  async executeTask(agentId: string, task: string, onFirstText?: () => void): Promise<string> {
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Get or create session for this agent
    let sessionId = this.activeSessions.get(agentId);
    let session = sessionId ? sessionManager.get(sessionId) : undefined;

    if (!session) {
      session = sessionManager.create(agentId);
      this.activeSessions.set(agentId, session.id);
      await messageBus.publish('session:start', { sessionId: session.id, agentId });
    }

    try {
      // Execute in session context
      const result = await sessionManager.provideAsync(session, async () => {
        agentRegistry.setStatus(agentId, 'busy');

        try {
          const response = await agent.process(task, onFirstText);
          return response;
        } finally {
          agentRegistry.setStatus(agentId, 'idle');
        }
      });

      return result;
    } catch (error) {
      await messageBus.publish('agent:error', { agentId, error });
      throw error;
    }
  }

  endSession(agentId: string): void {
    const sessionId = this.activeSessions.get(agentId);
    if (sessionId) {
      messageBus.publish('session:end', { sessionId, agentId });
      sessionManager.delete(sessionId);
      this.activeSessions.delete(agentId);
    }
  }

  async executeParallel(tasks: Array<{ agentId: string; task: string }>): Promise<string[]> {
    const promises = tasks.map(({ agentId, task }) =>
      this.executeTask(agentId, task)
    );

    return Promise.all(promises);
  }

  getStats() {
    return {
      agents: agentRegistry.getStats(),
      sessions: sessionManager.getStats(),
      events: {
        total: messageBus.getEventLog().length
      }
    };
  }

  shutdown(): void {
    // End all active sessions
    for (const agentId of this.activeSessions.keys()) {
      this.endSession(agentId);
    }
    sessionManager.clear();
    agentRegistry.clear();
    messageBus.clear();
    this.initialized = false;
  }
}
