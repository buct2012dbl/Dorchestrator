import { sessionManager } from './session.js';
import { agentRegistry } from './agent-registry.js';
import { messageBus } from './message-bus.js';
export class Orchestrator {
    initialized = false;
    activeSessions = new Map(); // agentId -> sessionId
    constructor(_config) { }
    async initialize() {
        if (this.initialized)
            return;
        // Set up event listeners
        this.setupEventListeners();
        this.initialized = true;
    }
    setupEventListeners() {
        messageBus.subscribe('agent:error', (data) => {
            console.error(`Agent error: ${data.agentId}`, data.error);
        });
    }
    createAgent(config) {
        return agentRegistry.create(config);
    }
    getAgent(id) {
        return agentRegistry.get(id);
    }
    async executeTask(agentId, task, onFirstText) {
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
                }
                finally {
                    agentRegistry.setStatus(agentId, 'idle');
                }
            });
            return result;
        }
        catch (error) {
            await messageBus.publish('agent:error', { agentId, error });
            throw error;
        }
    }
    endSession(agentId) {
        const sessionId = this.activeSessions.get(agentId);
        if (sessionId) {
            messageBus.publish('session:end', { sessionId, agentId });
            sessionManager.delete(sessionId);
            this.activeSessions.delete(agentId);
        }
    }
    async executeParallel(tasks) {
        const promises = tasks.map(({ agentId, task }) => this.executeTask(agentId, task));
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
    shutdown() {
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
//# sourceMappingURL=orchestrator.js.map