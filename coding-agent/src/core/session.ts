import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  toolCalls?: Array<{ id: string; name: string; arguments: string }>;
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

export class SessionManager {
  private sessions = new Map<string, Session>();
  private storage = new AsyncLocalStorage<Session>();

  create(agentId: string, parentId?: string): Session {
    const session: Session = {
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

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  current(): Session {
    const session = this.storage.getStore();
    if (!session) {
      throw new Error('No active session in current context');
    }
    return session;
  }

  tryGetCurrent(): Session | undefined {
    return this.storage.getStore();
  }

  provide<T>(session: Session, fn: () => T): T {
    return this.storage.run(session, fn);
  }

  async provideAsync<T>(session: Session, fn: () => Promise<T>): Promise<T> {
    return this.storage.run(session, fn);
  }

  update(id: string, updates: Partial<Session>): void {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    Object.assign(session, updates, { updatedAt: Date.now() });
  }

  addMessage(id: string, message: Message): void {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    session.messages.push(message);
    session.updatedAt = Date.now();
  }

  delete(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.abort.abort();
      this.sessions.delete(id);
    }
  }

  getChildren(parentId: string): Session[] {
    return Array.from(this.sessions.values()).filter(
      s => s.parentId === parentId
    );
  }

  clear(): void {
    for (const session of this.sessions.values()) {
      session.abort.abort();
    }
    this.sessions.clear();
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  getStats() {
    return {
      total: this.sessions.size,
      active: Array.from(this.sessions.values()).filter(
        s => !s.abort.signal.aborted
      ).length,
      byAgent: this.groupByAgent()
    };
  }

  private groupByAgent(): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const session of this.sessions.values()) {
      groups[session.agentId] = (groups[session.agentId] || 0) + 1;
    }
    return groups;
  }
}

export const sessionManager = new SessionManager();
