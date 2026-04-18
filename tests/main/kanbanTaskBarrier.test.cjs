const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createKanbanTaskBarrier,
  markKanbanTaskBarrierAgentCompleted,
  isKanbanTaskBarrierSatisfied,
} = require('../../src/main/kanbanTaskBarrier');

test('barrier is unsatisfied until all expected swarm agents complete', () => {
  let barrier = createKanbanTaskBarrier({ runId: 'run-1', agentIds: ['ceo', 'programmer', 'tester'] });
  assert.equal(isKanbanTaskBarrierSatisfied(barrier), false);

  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'ceo');
  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'programmer');
  assert.equal(isKanbanTaskBarrierSatisfied(barrier), false);

  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'tester');
  assert.equal(isKanbanTaskBarrierSatisfied(barrier), true);
});

test('barrier ignores duplicate and unexpected completion markers', () => {
  let barrier = createKanbanTaskBarrier({ runId: 'run-2', agentIds: ['ceo'] });
  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'tester');
  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'ceo');
  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'ceo');

  assert.deepEqual(barrier.completedAgentIds, ['ceo']);
});
