function createKanbanTaskBarrier({ runId, agentIds }) {
  return {
    runId,
    expectedAgentIds: Array.from(new Set(agentIds || [])),
    completedAgentIds: [],
  };
}

function markKanbanTaskBarrierAgentCompleted(barrier, agentId) {
  if (!barrier || !agentId) return barrier;
  if (!barrier.expectedAgentIds.includes(agentId)) return barrier;
  if (barrier.completedAgentIds.includes(agentId)) return barrier;

  return {
    ...barrier,
    completedAgentIds: [...barrier.completedAgentIds, agentId],
  };
}

function isKanbanTaskBarrierSatisfied(barrier) {
  if (!barrier) return true;
  return barrier.expectedAgentIds.every((agentId) => barrier.completedAgentIds.includes(agentId));
}

module.exports = {
  createKanbanTaskBarrier,
  markKanbanTaskBarrierAgentCompleted,
  isKanbanTaskBarrierSatisfied,
};
