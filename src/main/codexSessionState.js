const fs = require('fs');
const os = require('os');
const path = require('path');

function getCodexAgentHome(agentId, workspace = null) {
  if (workspace) {
    return path.join(workspace, '.dorchestrator', 'codex-homes', agentId);
  }
  return path.join(os.tmpdir(), 'ao-codex-home', agentId);
}

function hasPersistedCodexSession(agentId, workspace = null) {
  const agentHome = getCodexAgentHome(agentId, workspace);
  const historyPath = path.join(agentHome, 'history.jsonl');

  try {
    return fs.existsSync(historyPath) && fs.statSync(historyPath).size > 0;
  } catch {
    return false;
  }
}

module.exports = {
  getCodexAgentHome,
  hasPersistedCodexSession,
};
