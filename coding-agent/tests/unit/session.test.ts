import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SessionManager } from '../../src/core/session.js';

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let tempDir: string;

  beforeEach(() => {
    sessionManager = new SessionManager();
    tempDir = mkdtempSync(join(tmpdir(), 'coding-agent-session-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('create', () => {
    it('should create a new session', () => {
      const session = sessionManager.create('test-agent');

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.agentId).toBe('test-agent');
      expect(session.messages).toEqual([]);
      expect(session.parentId).toBeUndefined();
    });

    it('should create a child session', () => {
      const parent = sessionManager.create('parent-agent');
      const child = sessionManager.create('child-agent', parent.id);

      expect(child.parentId).toBe(parent.id);
    });
  });

  describe('get', () => {
    it('should retrieve a session by id', () => {
      const session = sessionManager.create('test-agent');
      const retrieved = sessionManager.get(session.id);

      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.get('non-existent');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('addMessage', () => {
    it('should add a message to session', () => {
      const session = sessionManager.create('test-agent');
      const message = {
        id: 'msg-1',
        role: 'user' as const,
        content: 'Hello',
        timestamp: Date.now()
      };

      sessionManager.addMessage(session.id, message);

      expect(session.messages).toHaveLength(1);
      expect(session.messages[0]).toBe(message);
    });
  });

  describe('getChildren', () => {
    it('should return child sessions', () => {
      const parent = sessionManager.create('parent-agent');
      const child1 = sessionManager.create('child-agent-1', parent.id);
      const child2 = sessionManager.create('child-agent-2', parent.id);

      const children = sessionManager.getChildren(parent.id);

      expect(children).toHaveLength(2);
      expect(children).toContain(child1);
      expect(children).toContain(child2);
    });
  });

  describe('delete', () => {
    it('should delete a session', () => {
      const session = sessionManager.create('test-agent');
      sessionManager.delete(session.id);

      expect(sessionManager.get(session.id)).toBeUndefined();
    });

    it('should abort session on delete', () => {
      const session = sessionManager.create('test-agent');
      sessionManager.delete(session.id);

      expect(session.abort.signal.aborted).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return session statistics', () => {
      sessionManager.create('agent-1');
      sessionManager.create('agent-1');
      sessionManager.create('agent-2');

      const stats = sessionManager.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byAgent['agent-1']).toBe(2);
      expect(stats.byAgent['agent-2']).toBe(1);
    });
  });

  describe('persistence', () => {
    it('should reload persisted sessions and messages from disk', () => {
      const persistencePath = join(tempDir, 'sessions.json');
      sessionManager.configurePersistence(persistencePath);

      const session = sessionManager.create('agent-1');
      sessionManager.addMessage(session.id, {
        id: 'msg-1',
        role: 'user',
        content: 'remember me',
        timestamp: Date.now(),
      });

      const reloaded = new SessionManager();
      reloaded.configurePersistence(persistencePath);

      const latest = reloaded.findLatestByAgent('agent-1');
      expect(latest).toBeDefined();
      expect(latest?.messages).toHaveLength(1);
      expect(latest?.messages[0]?.content).toBe('remember me');
    });
  });
});
