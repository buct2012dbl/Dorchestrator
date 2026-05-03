const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  getCodexAgentHome,
  hasPersistedCodexSession,
} = require('../../src/main/codexSessionState');

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dorchestrator-codex-session-'));
}

test('getCodexAgentHome uses workspace-local storage when a workspace is provided', () => {
  const workspacePath = createTempWorkspace();

  try {
    const agentHome = getCodexAgentHome('agent-ceo', workspacePath);
    assert.equal(agentHome, path.join(workspacePath, '.dorchestrator', 'codex-homes', 'agent-ceo'));
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
});

test('hasPersistedCodexSession detects whether a workspace-local codex history exists', () => {
  const workspacePath = createTempWorkspace();

  try {
    assert.equal(hasPersistedCodexSession('agent-ceo', workspacePath), false);

    const agentHome = getCodexAgentHome('agent-ceo', workspacePath);
    fs.mkdirSync(agentHome, { recursive: true });
    fs.writeFileSync(path.join(agentHome, 'history.jsonl'), '{"session_id":"abc"}\n');

    assert.equal(hasPersistedCodexSession('agent-ceo', workspacePath), true);
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }
});
