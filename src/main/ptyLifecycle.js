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
  const prevEdges = JSON.stringify(agentGraph.edges);
  const nextGraph = { agents, edges };

  orchestrator.syncAgents(agents);
  orchestrator.syncEdges(edges);
  graphConfigManager.saveGraphConfig(agents, edges);

  if (JSON.stringify(edges) !== prevEdges) {
    for (const agent of agents) {
      if (ptys.has(agent.id)) {
        const dims = ptyDims.get(agent.id) || { cols: 80, rows: 24 };
        spawnPty(agent.id, agent.data, dims.cols, dims.rows);
      }
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
