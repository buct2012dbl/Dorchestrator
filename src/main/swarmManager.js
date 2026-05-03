const fs = require('fs');
const path = require('path');

const DEFAULT_AGENT_STATUS = 'idle';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeAgents(agents = []) {
  return agents.map((agent) => ({
    ...agent,
    data: {
      ...agent.data,
      status: DEFAULT_AGENT_STATUS,
      unreadCount: 0,
      latestNotification: null,
    },
  }));
}

class SwarmManager {
  constructor() {
    this.configDir = null;
    this.configPath = null;
    this.selectedPath = null;
    this.memoryDir = null;
    this.sessionHistoryDir = null;
  }

  setWorkspace(workspacePath) {
    if (!workspacePath) {
      this.configDir = null;
      this.configPath = null;
      this.selectedPath = null;
      this.memoryDir = null;
      this.sessionHistoryDir = null;
      return;
    }

    this.configDir = path.join(workspacePath, '.dorchestrator');
    this.configPath = path.join(this.configDir, 'swarms.json');
    this.selectedPath = path.join(this.configDir, 'selected-swarm.json');
    this.memoryDir = path.join(this.configDir, 'swarm-memories');
    this.sessionHistoryDir = path.join(this.configDir, 'swarm-session-histories');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }

    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }

    if (!fs.existsSync(this.sessionHistoryDir)) {
      fs.mkdirSync(this.sessionHistoryDir, { recursive: true });
    }
  }

  getMemoryPath(id) {
    if (!this.memoryDir || !id) {
      return null;
    }

    return path.join(this.memoryDir, `${id}.json`);
  }

  getSessionHistoryPath(id) {
    if (!this.sessionHistoryDir || !id) {
      return null;
    }

    return path.join(this.sessionHistoryDir, `${id}.json`);
  }

  readRawSwarms() {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return [];
    }

    try {
      return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
    } catch (err) {
      console.error('[SwarmManager] Failed to read swarms:', err);
      return [];
    }
  }

  writeRawSwarms(swarms) {
    if (!this.configPath) {
      console.log('[SwarmManager] No workspace set, skipping save');
      return false;
    }

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(swarms, null, 2));
      return true;
    } catch (err) {
      console.error('[SwarmManager] Failed to write swarms:', err);
      return false;
    }
  }

  getSelectedSwarmId() {
    if (!this.selectedPath || !fs.existsSync(this.selectedPath)) {
      return null;
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.selectedPath, 'utf8'));
      return data.selectedSwarmId || null;
    } catch (err) {
      console.error('[SwarmManager] Failed to read selected swarm:', err);
      return null;
    }
  }

  setSelectedSwarmId(id) {
    if (!this.selectedPath) {
      return false;
    }

    try {
      fs.writeFileSync(this.selectedPath, JSON.stringify({ selectedSwarmId: id || null }, null, 2));
      return true;
    } catch (err) {
      console.error('[SwarmManager] Failed to write selected swarm:', err);
      return false;
    }
  }

  migrateLegacyGraphConfig() {
    if (!this.configDir) {
      return [];
    }

    const legacyPath = path.join(this.configDir, 'graph-config.json');
    if (!fs.existsSync(legacyPath)) {
      return [];
    }

    try {
      const legacy = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      if (!legacy?.agents || !legacy?.edges) {
        return [];
      }

      const migrated = [{
        id: 'swarm-1',
        name: 'Swarm 1',
        agents: sanitizeAgents(legacy.agents),
        edges: legacy.edges,
        createdAt: legacy.savedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }];

      this.writeRawSwarms(migrated);
      this.setSelectedSwarmId('swarm-1');
      console.log('[SwarmManager] Migrated legacy graph config into swarms.json');
      return migrated;
    } catch (err) {
      console.error('[SwarmManager] Failed to migrate legacy graph config:', err);
      return [];
    }
  }

  loadSwarms() {
    let swarms = this.readRawSwarms();
    if (swarms.length === 0) {
      swarms = this.migrateLegacyGraphConfig();
    }

    return swarms.map((swarm) => ({
      ...clone(swarm),
      agents: sanitizeAgents(swarm.agents),
      edges: clone(swarm.edges || []),
    }));
  }

  saveSwarm(swarm) {
    if (!swarm?.id) {
      return false;
    }

    const swarms = this.readRawSwarms();
    const now = new Date().toISOString();
    const nextSwarm = {
      ...clone(swarm),
      agents: clone(swarm.agents || []),
      edges: clone(swarm.edges || []),
      updatedAt: now,
    };

    const index = swarms.findIndex((item) => item.id === swarm.id);
    if (index >= 0) {
      nextSwarm.createdAt = swarms[index].createdAt || swarm.createdAt || now;
      swarms[index] = nextSwarm;
    } else {
      nextSwarm.createdAt = swarm.createdAt || now;
      swarms.push(nextSwarm);
    }

    return this.writeRawSwarms(swarms);
  }

  loadSwarmMemory(id) {
    const memoryPath = this.getMemoryPath(id);
    if (!memoryPath || !fs.existsSync(memoryPath)) {
      return {};
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
      const agents = parsed?.agents;
      if (!agents || typeof agents !== 'object' || Array.isArray(agents)) {
        return {};
      }

      const normalized = {};
      for (const [agentId, history] of Object.entries(agents)) {
        if (Array.isArray(history)) {
          normalized[agentId] = clone(history);
        }
      }
      return normalized;
    } catch (err) {
      console.error('[SwarmManager] Failed to read swarm memory:', err);
      return {};
    }
  }

  saveSwarmMemory(id, histories) {
    const memoryPath = this.getMemoryPath(id);
    if (!memoryPath) {
      return false;
    }

    const agents = {};
    for (const [agentId, history] of Object.entries(histories || {})) {
      if (Array.isArray(history) && history.length > 0) {
        agents[agentId] = clone(history);
      }
    }

    try {
      fs.writeFileSync(memoryPath, JSON.stringify({
        swarmId: id,
        updatedAt: new Date().toISOString(),
        agents,
      }, null, 2));
      return true;
    } catch (err) {
      console.error('[SwarmManager] Failed to write swarm memory:', err);
      return false;
    }
  }

  clearSwarmMemory(id, agentId = null) {
    if (!id) {
      return false;
    }

    if (!agentId) {
      return this.deleteSwarmMemory(id);
    }

    const histories = this.loadSwarmMemory(id);
    if (!histories[agentId]) {
      return true;
    }

    delete histories[agentId];
    return this.saveSwarmMemory(id, histories);
  }

  loadSwarmSessionHistories(id) {
    const sessionPath = this.getSessionHistoryPath(id);
    if (!sessionPath || !fs.existsSync(sessionPath)) {
      return {};
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      const agents = parsed?.agents;
      if (!agents || typeof agents !== 'object' || Array.isArray(agents)) {
        return {};
      }

      const normalized = {};
      for (const [agentId, history] of Object.entries(agents)) {
        if (Array.isArray(history)) {
          normalized[agentId] = clone(history);
        }
      }
      return normalized;
    } catch (err) {
      console.error('[SwarmManager] Failed to read swarm session histories:', err);
      return {};
    }
  }

  saveSwarmSessionHistories(id, histories) {
    const sessionPath = this.getSessionHistoryPath(id);
    if (!sessionPath) {
      return false;
    }

    const agents = {};
    for (const [agentId, history] of Object.entries(histories || {})) {
      if (Array.isArray(history) && history.length > 0) {
        agents[agentId] = clone(history);
      }
    }

    try {
      fs.writeFileSync(sessionPath, JSON.stringify({
        swarmId: id,
        updatedAt: new Date().toISOString(),
        agents,
      }, null, 2));
      return true;
    } catch (err) {
      console.error('[SwarmManager] Failed to write swarm session histories:', err);
      return false;
    }
  }

  clearSwarmSessionHistories(id, agentId = null) {
    if (!id) {
      return false;
    }

    const sessionPath = this.getSessionHistoryPath(id);
    if (!sessionPath) {
      return false;
    }

    if (!agentId) {
      if (!fs.existsSync(sessionPath)) {
        return true;
      }
      try {
        fs.rmSync(sessionPath, { force: true });
        return true;
      } catch (err) {
        console.error('[SwarmManager] Failed to delete swarm session histories:', err);
        return false;
      }
    }

    const histories = this.loadSwarmSessionHistories(id);
    if (!histories[agentId]) {
      return true;
    }

    delete histories[agentId];
    return this.saveSwarmSessionHistories(id, histories);
  }

  deleteSwarmMemory(id) {
    const memoryPath = this.getMemoryPath(id);
    if (!memoryPath || !fs.existsSync(memoryPath)) {
      return true;
    }

    try {
      fs.unlinkSync(memoryPath);
      return true;
    } catch (err) {
      console.error('[SwarmManager] Failed to delete swarm memory:', err);
      return false;
    }
  }

  deleteSwarm(id) {
    if (!id) {
      return false;
    }

    const swarms = this.readRawSwarms().filter((swarm) => swarm.id !== id);
    const saved = this.writeRawSwarms(swarms);
    if (!saved) {
      return false;
    }

    if (!this.deleteSwarmMemory(id)) {
      return false;
    }

    if (this.getSelectedSwarmId() === id) {
      this.setSelectedSwarmId(swarms[0]?.id || null);
    }
    return true;
  }
}

module.exports = new SwarmManager();
