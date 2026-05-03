import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
export class SessionManager {
    sessions = new Map();
    storage = new AsyncLocalStorage();
    persistencePath = null;
    configurePersistence(filePath) {
        this.persistencePath = filePath || null;
        this.sessions.clear();
        if (!this.persistencePath || !existsSync(this.persistencePath)) {
            return;
        }
        try {
            const parsed = JSON.parse(readFileSync(this.persistencePath, 'utf8'));
            const records = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
            for (const record of records) {
                if (!record?.id || !record?.agentId)
                    continue;
                this.sessions.set(record.id, {
                    id: record.id,
                    parentId: record.parentId,
                    agentId: record.agentId,
                    messages: Array.isArray(record.messages) ? record.messages : [],
                    context: record.context || {},
                    metadata: record.metadata || {},
                    abort: new AbortController(),
                    createdAt: record.createdAt || Date.now(),
                    updatedAt: record.updatedAt || Date.now(),
                });
            }
        }
        catch (error) {
            console.warn(`Failed to load persisted sessions from ${this.persistencePath}:`, error);
        }
    }
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
        this.persist();
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
        this.persist();
    }
    addMessage(id, message) {
        const session = this.sessions.get(id);
        if (!session) {
            throw new Error(`Session ${id} not found`);
        }
        session.messages.push(message);
        session.updatedAt = Date.now();
        this.persist();
    }
    delete(id) {
        const session = this.sessions.get(id);
        if (session) {
            session.abort.abort();
            this.sessions.delete(id);
            this.persist();
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
        this.persist();
    }
    getAll() {
        return Array.from(this.sessions.values());
    }
    findLatestByAgent(agentId) {
        const matches = Array.from(this.sessions.values())
            .filter((session) => session.agentId === agentId && !session.abort.signal.aborted)
            .sort((a, b) => b.updatedAt - a.updatedAt);
        return matches[0];
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
    persist() {
        if (!this.persistencePath) {
            return;
        }
        try {
            mkdirSync(dirname(this.persistencePath), { recursive: true });
            const sessions = Array.from(this.sessions.values()).map((session) => ({
                id: session.id,
                parentId: session.parentId,
                agentId: session.agentId,
                messages: session.messages,
                context: session.context,
                metadata: session.metadata,
                createdAt: session.createdAt,
                updatedAt: session.updatedAt,
            }));
            writeFileSync(this.persistencePath, JSON.stringify({ sessions }, null, 2));
        }
        catch (error) {
            console.warn(`Failed to persist sessions to ${this.persistencePath}:`, error);
        }
    }
}
export const sessionManager = new SessionManager();
//# sourceMappingURL=session.js.map