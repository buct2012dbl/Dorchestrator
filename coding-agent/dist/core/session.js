import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
export class SessionManager {
    sessions = new Map();
    storage = new AsyncLocalStorage();
    create(agentId, parentId) {
        const session = {
            id: randomUUID(),
            parentId,
            agentId,
            messages: [],
            context: {},
            metadata: {},
            abort: new AbortController(),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.sessions.set(session.id, session);
        return session;
    }
    get(id) {
        return this.sessions.get(id);
    }
    current() {
        const session = this.storage.getStore();
        if (!session) {
            throw new Error('No active session in current context');
        }
        return session;
    }
    tryGetCurrent() {
        return this.storage.getStore();
    }
    provide(session, fn) {
        return this.storage.run(session, fn);
    }
    async provideAsync(session, fn) {
        return this.storage.run(session, fn);
    }
    update(id, updates) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error(`Session ${id} not found`);
        }
        Object.assign(session, updates, { updatedAt: Date.now() });
    }
    addMessage(id, message) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error(`Session ${id} not found`);
        }
        session.messages.push(message);
        session.updatedAt = Date.now();
    }
    delete(id) {
        const session = this.sessions.get(id);
        if (session) {
            session.abort.abort();
            this.sessions.delete(id);
        }
    }
    getChildren(parentId) {
        return Array.from(this.sessions.values()).filter(s => s.parentId === parentId);
    }
    clear() {
        for (const session of this.sessions.values()) {
            session.abort.abort();
        }
        this.sessions.clear();
    }
    getAll() {
        return Array.from(this.sessions.values());
    }
    getStats() {
        return {
            total: this.sessions.size,
            active: Array.from(this.sessions.values()).filter(s => !s.abort.signal.aborted).length,
            byAgent: this.groupByAgent()
        };
    }
    groupByAgent() {
        const groups = {};
        for (const session of this.sessions.values()) {
            groups[session.agentId] = (groups[session.agentId] || 0) + 1;
        }
        return groups;
    }
}
export const sessionManager = new SessionManager();
//# sourceMappingURL=session.js.map