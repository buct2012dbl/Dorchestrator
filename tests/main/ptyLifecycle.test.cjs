const test = require('node:test');
const assert = require('node:assert/strict');
const {
  syncAgentsAndRespawn,
  resizeTrackedPty,
  killTrackedPtyById,
} = require('../../src/main/ptyLifecycle');

test('syncAgentsAndRespawn only respawns tracked PTYs when edges change', () => {
  const spawnCalls = [];
  const orchestrator = {
    syncAgentsCalls: [],
    syncEdgesCalls: [],
    syncAgents(agents) { this.syncAgentsCalls.push(agents); },
    syncEdges(edges) { this.syncEdgesCalls.push(edges); },
  };
  const graphConfigManager = {
    saved: [],
    saveGraphConfig(agents, edges) { this.saved.push({ agents, edges }); },
  };
  const ptys = new Map([['a1', {}]]);
  const ptyDims = new Map([['a1', { cols: 120, rows: 40 }]]);
  const agents = [
    { id: 'a1', data: { name: 'Tracked' } },
    { id: 'a2', data: { name: 'Not running' } },
  ];

  const nextGraph = syncAgentsAndRespawn({
    agentGraph: { agents: [], edges: [{ source: 'a1', target: 'a2' }] },
    agents,
    edges: [{ source: 'a2', target: 'a1' }],
    orchestrator,
    graphConfigManager,
    ptys,
    ptyDims,
    spawnPty: (...args) => spawnCalls.push(args),
  });

  assert.deepEqual(nextGraph, { agents, edges: [{ source: 'a2', target: 'a1' }] });
  assert.equal(spawnCalls.length, 1);
  assert.deepEqual(spawnCalls[0], ['a1', { name: 'Tracked' }, 120, 40]);
  assert.deepEqual(orchestrator.syncAgentsCalls, [agents]);
  assert.deepEqual(orchestrator.syncEdgesCalls, [[{ source: 'a2', target: 'a1' }]]);
  assert.equal(graphConfigManager.saved.length, 1);
});

test('syncAgentsAndRespawn skips respawn when edges are unchanged', () => {
  const spawnCalls = [];
  const edges = [{ source: 'a1', target: 'a2' }];

  syncAgentsAndRespawn({
    agentGraph: { agents: [], edges },
    agents: [{ id: 'a1', data: {} }],
    edges,
    orchestrator: { syncAgents() {}, syncEdges() {} },
    graphConfigManager: { saveGraphConfig() {} },
    ptys: new Map([['a1', {}]]),
    ptyDims: new Map(),
    spawnPty: (...args) => spawnCalls.push(args),
  });

  assert.equal(spawnCalls.length, 0);
});

test('resizeTrackedPty normalizes swarm PTY sizes and stores requested dims', () => {
  const resizeCalls = [];
  const ptyMap = new Map([['a1', { resize: (...args) => resizeCalls.push(args) }]]);
  const dimsMap = new Map();

  const didResize = resizeTrackedPty(ptyMap, dimsMap, 'a1', 0, -5, true);

  assert.equal(didResize, true);
  assert.deepEqual(resizeCalls, [[1, 1]]);
  assert.deepEqual(dimsMap.get('a1'), { cols: 0, rows: -5 });
});

test('killTrackedPtyById removes PTY state even if kill throws', () => {
  const ptyMap = new Map([['mux-1', { kill() { throw new Error('already exited'); } }]]);
  const dimsMap = new Map([['mux-1', { cols: 80, rows: 24 }]]);

  const killed = killTrackedPtyById(ptyMap, dimsMap, 'mux-1');

  assert.equal(killed, true);
  assert.equal(ptyMap.has('mux-1'), false);
  assert.equal(dimsMap.has('mux-1'), false);
});
