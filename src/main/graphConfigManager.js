const fs = require('fs');
const path = require('path');

class GraphConfigManager {
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
    this.configPath = path.join(this.configDir, 'graph-config.json');

    // Ensure directory exists
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  saveGraphConfig(agents, edges) {
    if (!this.configPath) {
      console.log('[GraphConfig] No workspace set, skipping save');
      return false;
    }

    try {
      const config = {
        version: '1.0',
        savedAt: new Date().toISOString(),
        agents,
        edges,
      };

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`[GraphConfig] Saved to ${this.configPath}`);
      return true;
    } catch (err) {
      console.error('[GraphConfig] Failed to save:', err);
      return false;
    }
  }

  loadGraphConfig() {
    if (!this.configPath) {
      console.log('[GraphConfig] No workspace set, returning null');
      return null;
    }

    if (!fs.existsSync(this.configPath)) {
      console.log('[GraphConfig] Config file does not exist');
      return null;
    }

    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      const config = JSON.parse(data);
      console.log(`[GraphConfig] Loaded from ${this.configPath}`);
      return {
        agents: config.agents || [],
        edges: config.edges || [],
      };
    } catch (err) {
      console.error('[GraphConfig] Failed to load:', err);
      return null;
    }
  }

  hasConfig() {
    return this.configPath && fs.existsSync(this.configPath);
  }
}

module.exports = new GraphConfigManager();
