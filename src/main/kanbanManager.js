const fs = require('fs');
const path = require('path');

const DEFAULT_STATE = {
  selectedView: 'board',
  tasks: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createDefaultRun() {
  return {
    id: null,
    startedAt: null,
    completedAt: null,
    status: 'idle',
    prompt: '',
    displayPrompt: '',
    reply: '',
    finalResponse: '',
    transcript: '',
    segments: [],
  };
}

function normalizeRun(run = {}) {
  return {
    ...createDefaultRun(),
    ...run,
    segments: Array.isArray(run.segments) ? run.segments : [],
  };
}

function normalizeTask(task = {}) {
  const now = new Date().toISOString();
  return {
    id: task.id,
    title: task.title || 'Untitled Task',
    prompt: task.prompt || '',
    stage: task.stage || 'todo',
    targetType: task.targetType || 'agent',
    targetId: task.targetId || null,
    entryAgentId: task.entryAgentId || null,
    createdAt: task.createdAt || now,
    updatedAt: task.updatedAt || now,
    runStatus: task.runStatus || 'idle',
    lastError: task.lastError || null,
    currentRunId: task.currentRunId || null,
    history: Array.isArray(task.history) ? task.history : [],
    runs: Array.isArray(task.runs) ? task.runs.map(normalizeRun) : [],
  };
}

class KanbanManager {
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
    this.configPath = path.join(this.configDir, 'kanban.json');

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  readRawState() {
    if (!this.configPath || !fs.existsSync(this.configPath)) {
      return clone(DEFAULT_STATE);
    }

    try {
      const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      return {
        ...clone(DEFAULT_STATE),
        ...(data || {}),
      };
    } catch (err) {
      console.error('[KanbanManager] Failed to read kanban state:', err);
      return clone(DEFAULT_STATE);
    }
  }

  writeRawState(state) {
    if (!this.configPath) {
      return false;
    }

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(state, null, 2));
      return true;
    } catch (err) {
      console.error('[KanbanManager] Failed to write kanban state:', err);
      return false;
    }
  }

  loadState() {
    const state = this.readRawState();
    return {
      selectedView: state.selectedView || 'board',
      tasks: Array.isArray(state.tasks) ? state.tasks.map((task) => normalizeTask(clone(task))) : [],
    };
  }

  saveState(state) {
    return this.writeRawState({
      selectedView: state?.selectedView || 'board',
      tasks: Array.isArray(state?.tasks) ? state.tasks.map((task) => normalizeTask(task)) : [],
    });
  }
}

module.exports = new KanbanManager();
