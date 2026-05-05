function buildConnectionMap(edges) {
  const map = new Map();

  for (const edge of edges || []) {
    if (!map.has(edge.source)) map.set(edge.source, new Set());
    if (!map.has(edge.target)) map.set(edge.target, new Set());
    map.get(edge.source).add(edge.target);
    map.get(edge.target).add(edge.source);
  }

  return map;
}

function getConnectionSignature(connectionMap, agentId) {
  const connected = connectionMap.get(agentId);
  if (!connected || connected.size === 0) {
    return '';
  }

  return [...connected].sort().join('|');
}

function syncAgentsAndRespawn({
  agentGraph,
  agents,
  edges,
  orchestrator,
  graphConfigManager,
  ptys,
  ptyDims,
  spawnPty,
}) {
  const prevConnectionMap = buildConnectionMap(agentGraph.edges);
  const nextConnectionMap = buildConnectionMap(edges);
  const previousAgentIds = new Set((agentGraph.agents || []).map((agent) => agent.id));
  const nextGraph = { agents, edges };

  orchestrator.syncAgents(agents);
  orchestrator.syncEdges(edges);
  graphConfigManager.saveGraphConfig(agents, edges);

  for (const agent of agents) {
    if (!ptys.has(agent.id)) {
      continue;
    }

    if (!previousAgentIds.has(agent.id)) {
      continue;
    }

    const prevSignature = getConnectionSignature(prevConnectionMap, agent.id);
    const nextSignature = getConnectionSignature(nextConnectionMap, agent.id);

    if (prevSignature !== nextSignature) {
      const dims = ptyDims.get(agent.id) || { cols: 80, rows: 24 };
      spawnPty(agent.id, agent.data, dims.cols, dims.rows);
    }
  }

  return nextGraph;
}

function resizeTrackedPty(ptyMap, dimsMap, id, cols, rows, normalize = false) {
  const ptyProcess = ptyMap.get(id);
  if (!ptyProcess) return false;

  const nextCols = normalize ? Math.max(1, cols) : cols;
  const nextRows = normalize ? Math.max(1, rows) : rows;
  try {
    ptyProcess.resize(nextCols, nextRows);
  } catch {}
  dimsMap.set(id, { cols, rows });
  return true;
}

function killTrackedPtyById(ptyMap, dimsMap, id) {
  if (!ptyMap.has(id)) return false;
  try { ptyMap.get(id).kill(); } catch {}
  ptyMap.delete(id);
  dimsMap.delete(id);
  return true;
}

module.exports = {
  syncAgentsAndRespawn,
  resizeTrackedPty,
  killTrackedPtyById,
};
