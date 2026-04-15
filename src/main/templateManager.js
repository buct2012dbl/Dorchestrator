const fs = require('fs');
const path = require('path');

class TemplateManager {
  constructor() {
    this.configDir = null;
    this.configPath = null;
    this.selectedPath = null;
    this.uiStatePath = null;
  }

  setWorkspace(workspacePath) {
    if (!workspacePath) {
      this.configDir = null;
      this.configPath = null;
      this.selectedPath = null;
      this.uiStatePath = null;
      return;
    }

    this.configDir = path.join(workspacePath, '.dorchestrator');
    this.configPath = path.join(this.configDir, 'mux-templates.json');
    this.selectedPath = path.join(this.configDir, 'selected-template.json');
    this.uiStatePath = path.join(this.configDir, 'mux-ui-state.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadTemplates() {
    if (!this.configPath) {
      console.log('[TemplateManager] No workspace set, returning empty array');
      return [];
    }

    if (!fs.existsSync(this.configPath)) {
      console.log('[TemplateManager] Config file does not exist, returning empty array');
      return [];
    }

    try {
      const data = fs.readFileSync(this.configPath, 'utf8');
      const templates = JSON.parse(data);
      console.log(`[TemplateManager] Loaded ${templates.length} templates from ${this.configPath}`);
      return templates;
    } catch (err) {
      console.error('[TemplateManager] Failed to load:', err);
      return [];
    }
  }

  saveTemplate(template) {
    if (!this.configPath) {
      console.log('[TemplateManager] No workspace set, skipping save');
      return false;
    }

    try {
      const templates = this.loadTemplates();
      const index = templates.findIndex(t => t.id === template.id);

      if (index >= 0) {
        templates[index] = template;
      } else {
        templates.push(template);
      }

      fs.writeFileSync(this.configPath, JSON.stringify(templates, null, 2));
      console.log(`[TemplateManager] Saved template ${template.id} to ${this.configPath}`);
      return true;
    } catch (err) {
      console.error('[TemplateManager] Failed to save:', err);
      return false;
    }
  }

  deleteTemplate(id) {
    if (!this.configPath) {
      console.log('[TemplateManager] No workspace set, skipping delete');
      return false;
    }

    try {
      const templates = this.loadTemplates();
      const filtered = templates.filter(t => t.id !== id);

      fs.writeFileSync(this.configPath, JSON.stringify(filtered, null, 2));
      console.log(`[TemplateManager] Deleted template ${id}`);
      return true;
    } catch (err) {
      console.error('[TemplateManager] Failed to delete:', err);
      return false;
    }
  }

  getSelectedTemplateId() {
    if (!this.selectedPath || !fs.existsSync(this.selectedPath)) return null;
    try {
      const data = JSON.parse(fs.readFileSync(this.selectedPath, 'utf8'));
      return data.selectedTemplateId || null;
    } catch {
      return null;
    }
  }

  setSelectedTemplateId(id) {
    if (!this.selectedPath) return false;
    try {
      fs.writeFileSync(this.selectedPath, JSON.stringify({ selectedTemplateId: id }, null, 2));
      return true;
    } catch (err) {
      console.error('[TemplateManager] Failed to save selected template:', err);
      return false;
    }
  }

  getUiState() {
    if (!this.uiStatePath || !fs.existsSync(this.uiStatePath)) {
      return { sidebarCollapsed: false };
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.uiStatePath, 'utf8'));
      return {
        sidebarCollapsed: Boolean(data?.sidebarCollapsed),
      };
    } catch (err) {
      console.error('[TemplateManager] Failed to load mux UI state:', err);
      return { sidebarCollapsed: false };
    }
  }

  saveUiState(nextState = {}) {
    if (!this.uiStatePath) {
      return false;
    }

    try {
      const currentState = this.getUiState();
      const mergedState = {
        ...currentState,
        ...nextState,
        sidebarCollapsed: Boolean(nextState.sidebarCollapsed),
      };
      fs.writeFileSync(this.uiStatePath, JSON.stringify(mergedState, null, 2));
      return true;
    } catch (err) {
      console.error('[TemplateManager] Failed to save mux UI state:', err);
      return false;
    }
  }
}

module.exports = new TemplateManager();
