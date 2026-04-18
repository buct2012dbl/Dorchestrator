const test = require('node:test');
const assert = require('node:assert/strict');
const {
  hasKanbanTaskSettled,
  getKanbanTaskSettlementDelay,
} = require('../../src/main/kanbanTaskSettlement');

test('hasKanbanTaskSettled returns false while the quiet window is still open', () => {
  assert.equal(
    hasKanbanTaskSettled({ lastActivityAt: 1000, now: 1800, quietMs: 1200 }),
    false,
  );
});

test('hasKanbanTaskSettled returns true once the quiet window has elapsed', () => {
  assert.equal(
    hasKanbanTaskSettled({ lastActivityAt: 1000, now: 2300, quietMs: 1200 }),
    true,
  );
});

test('getKanbanTaskSettlementDelay returns the remaining quiet-window wait time', () => {
  assert.equal(
    getKanbanTaskSettlementDelay({ lastActivityAt: 1000, now: 1600, quietMs: 1200 }),
    600,
  );
});
