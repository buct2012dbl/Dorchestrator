export class AgentRegistry {
    agents = new Map();
    factories = new Map();
    registerFactory(type, factory) {
        this.factories.set(type, factory);
    }
    create(config) {
        const factory = this.factories.get(config.type);
        if (!factory) {
            throw new Error(`No factory registered for agent type: ${config.type}`);
        }
        const agent = factory(config);
        const instance = {
            agent,
            config,
            status: 'idle',
            createdAt: Date.now(),
            lastUsed: Date.now()
        };
        this.agents.set(config.id, instance);
        return agent;
    }
    get(id) {
        const instance = this.agents.get(id);
        if (instance) {
            instance.lastUsed = Date.now();
            return instance.agent;
        }
        return undefined;
    }
    getConfig(id) {
        return this.agents.get(id)?.config;
    }
    getStatus(id) {
        return this.agents.get(id)?.status;
    }
    setStatus(id, status) {
        const instance = this.agents.get(id);
        if (instance) {
            instance.status = status;
        }
    }
    delete(id) {
        this.agents.delete(id);
    }
    getAll() {
        return Array.from(this.agents.values()).map(i => i.agent);
    }
    getAllConfigs() {
        return Array.from(this.agents.values()).map(i => i.config);
    }
    has(id) {
        return this.agents.has(id);
    }
    clear() {
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
    groupByType(instances) {
        const groups = {};
        for (const instance of instances) {
            groups[instance.config.type] = (groups[instance.config.type] || 0) + 1;
        }
        return groups;
    }
    groupByStatus(instances) {
        const groups = {
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
//# sourceMappingURL=agent-registry.js.map