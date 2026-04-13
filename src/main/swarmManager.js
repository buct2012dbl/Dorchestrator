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
  }

  setWorkspace(workspacePath) {
    if (!workspacePath) {
      this.configDir = null;
      this.configPath = null;
      this.selectedPath = null;
      return;
    }

    this.configDir = path.join(workspacePath, '.dorchestrator');
    this.configPath = path.join(this.configDir, 'swarms.json');
    this.selectedPath = path.join(this.configDir, 'selected-swarm.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
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

  deleteSwarm(id) {
    if (!id) {
      return false;
    }

    const swarms = this.readRawSwarms().filter((swarm) => swarm.id !== id);
    const saved = this.writeRawSwarms(swarms);
    if (saved && this.getSelectedSwarmId() === id) {
      this.setSelectedSwarmId(swarms[0]?.id || null);
    }
    return saved;
  }
}

module.exports = new SwarmManager();
