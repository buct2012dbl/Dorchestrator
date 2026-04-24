function shouldAutoDispatchBridgeDelivery({ kind = 'message', targetTaskId = null }) {
  // In Kanban runs, a response back to the delegator should settle the task graph,
  // not start a new execution round for the original sender.
  if (kind === 'response' && targetTaskId) {
    return false;
  }

  return true;
}

module.exports = {
  shouldAutoDispatchBridgeDelivery,
};
