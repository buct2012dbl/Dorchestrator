const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

function createTempWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dorchestrator-swarm-manager-'));
}

function cleanupWorkspace(workspacePath) {
  fs.rmSync(workspacePath, { recursive: true, force: true });
}

test('swarmManager persists, clears, and deletes swarm memory files', () => {
  const workspacePath = createTempWorkspace();
  const managerPath = require.resolve('../../src/main/swarmManager');
  delete require.cache[managerPath];
  const swarmManager = require('../../src/main/swarmManager');

  try {
    swarmManager.setWorkspace(workspacePath);

    const firstSave = swarmManager.saveSwarmMemory('swarm-1', {
      'agent-a': [{ role: 'user', content: 'hello' }],
      'agent-b': [],
    });
    assert.equal(firstSave, true);

    const memoryPath = path.join(workspacePath, '.dorchestrator', 'swarm-memories', 'swarm-1.json');
    assert.equal(fs.existsSync(memoryPath), true);
    assert.deepEqual(swarmManager.loadSwarmMemory('swarm-1'), {
      'agent-a': [{ role: 'user', content: 'hello' }],
    });

    const clearedAgent = swarmManager.clearSwarmMemory('swarm-1', 'agent-a');
    assert.equal(clearedAgent, true);
    assert.deepEqual(swarmManager.loadSwarmMemory('swarm-1'), {});

    const resaved = swarmManager.saveSwarmMemory('swarm-1', {
      'agent-a': [{ role: 'assistant', content: [{ type: 'text', text: 'back' }] }],
    });
    assert.equal(resaved, true);

    const savedSwarm = swarmManager.saveSwarm({
      id: 'swarm-1',
      name: 'Swarm 1',
      agents: [],
      edges: [],
    });
    assert.equal(savedSwarm, true);

    const deleted = swarmManager.deleteSwarm('swarm-1');
    assert.equal(deleted, true);
    assert.equal(fs.existsSync(memoryPath), false);
  } finally {
    cleanupWorkspace(workspacePath);
    delete require.cache[managerPath];
  }
});
