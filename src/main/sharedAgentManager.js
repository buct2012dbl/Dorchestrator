const fs = require('fs');
const path = require('path');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeAgent(agent = {}) {
  const now = new Date().toISOString();
  return {
    id: agent.id,
    name: agent.name || agent.role || 'Agent',
    role: agent.role || agent.name || 'Agent',
    color: agent.color || '#6b6b6b',
    description: agent.description || '',
    systemPrompt: agent.systemPrompt || '',
    model: agent.model || 'claude-sonnet-4-6',
    terminalType: agent.terminalType || agent.cliType || 'claude-code',
    createdAt: agent.createdAt || now,
    updatedAt: now,
  };
}

class SharedAgentManager {
  constructor() {
    this.configDir = null;
    this.configPath = null;
  }

  setWorkspace(workspacePath) {
    if (!workspacePath) {
      this.configDir = null;
      this.configPath = null;
      return;
    }

    this.configDir = path.join(workspacePath, '.dorchestrator');
    this.configPath = path.join(this.configDir, 'agents.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  readRawAgents() {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return [];
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error('[SharedAgentManager] Failed to read agents:', err);
      return [];
    }
  }

  writeRawAgents(agents) {
    if (!this.configPath) {
      return false;
    }

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(agents, null, 2));
      return true;
    } catch (err) {
      console.error('[SharedAgentManager] Failed to write agents:', err);
      return false;
    }
  }

  loadAgents() {
    return this.readRawAgents().map((agent) => normalizeAgent(clone(agent)));
  }

  saveAgent(agent) {
    if (!agent?.id) {
      return false;
    }

    const agents = this.readRawAgents();
    const nextAgent = normalizeAgent(clone(agent));
    const index = agents.findIndex((item) => item.id === nextAgent.id);

    if (index >= 0) {
      nextAgent.createdAt = agents[index].createdAt || nextAgent.createdAt;
      agents[index] = nextAgent;
    } else {
      agents.push(nextAgent);
    }

    return this.writeRawAgents(agents);
  }

  deleteAgent(id) {
    if (!id) {
      return false;
    }

    const agents = this.readRawAgents().filter((agent) => agent.id !== id);
    return this.writeRawAgents(agents);
  }
}

module.exports = new SharedAgentManager();
