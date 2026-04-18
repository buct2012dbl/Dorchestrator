function hasKanbanTaskSettled({ lastActivityAt, now = Date.now(), quietMs = 1200 }) {
  if (!lastActivityAt) return true;
  return now - lastActivityAt >= quietMs;
}

function getKanbanTaskSettlementDelay({ lastActivityAt, now = Date.now(), quietMs = 1200 }) {
  if (!lastActivityAt) return 0;
  return Math.max(0, quietMs - (now - lastActivityAt));
}

module.exports = {
  hasKanbanTaskSettled,
  getKanbanTaskSettlementDelay,
};
