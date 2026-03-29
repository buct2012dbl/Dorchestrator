import { createContext, useContext } from 'react';

// Agent roles with default configurations
export const AGENT_TEMPLATES = {
  ceo: {
    role: 'CEO',
    color: '#c27c0e',
    description: 'Coordinates tasks, delegates work, reviews outcomes',
    systemPrompt: 'You are a CEO agent. You coordinate tasks between team members, make high-level decisions, never write and test code or research, delegate work to the programmer and tester and researcher, and review final outcomes. Once get message from agent-bridge mcp must respond back through agent-bridge to original sender.',
    model: 'claude-sonnet-4-6',
    terminalType: 'claude-code',
  },
  programmer: {
    role: 'Programmer',
    color: '#2d7d46',
    description: 'Writes code, implements features, fixes bugs',
    systemPrompt: 'You are a Programmer agent. You write code, implement features, fix bugs, and follow instructions from the CEO agent.Once get message from agent-bridge mcp must respond back through agent-bridge to original sender.',
    model: 'claude-sonnet-4-6',
    terminalType: 'claude-code',
  },
  tester: {
    role: 'Tester',
    color: '#8b3a62',
    description: 'Tests code, reports bugs, validates functionality',
    systemPrompt: 'You are a Tester agent. You write and run tests, report bugs, validate functionality, and provide feedback to the programmer.Once get message from agent-bridge mcp must respond back through agent-bridge to original sender.',
    model: 'claude-sonnet-4-6',
    terminalType: 'claude-code',
  },
  researcher: {
    role: 'Researcher',
    color: '#2d5f8d',
    description: 'Researches topics, gathers information, provides context',
    systemPrompt: 'You are a Researcher agent. You research topics, gather information, analyze data, and provide context for decision making.Once get message from agent-bridge mcp must respond back through agent-bridge to original sender.',
    model: 'claude-sonnet-4-6',
    terminalType: 'claude-code',
  },
  custom: {
    role: 'Custom Agent',
    color: '#6b6b6b',
    description: 'A custom agent with user-defined behavior',
    systemPrompt: 'You are a helpful assistant.Once get message from agent-bridge mcp must respond back through agent-bridge to original sender.',
    model: 'claude-sonnet-4-6',
    terminalType: 'claude-code',
  },
};

export const NODE_STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  SUCCESS: 'success',
  ERROR: 'error',
  WAITING: 'waiting',
};

export const STATUS_COLORS = {
  idle: '#6b6b6b',
  running: '#2472c8',
  success: '#0dbc79',
  error: '#cd3131',
  waiting: '#e5e510',
};

export function generateId(existingIds = new Set()) {
  let id;
  do {
    const randomPart =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    id = `agent-${randomPart}`;
  } while (existingIds.has(id));
  return id;
}
