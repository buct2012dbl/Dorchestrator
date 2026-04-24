const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addKanbanTaskBarrierExpectedAgent,
  createKanbanTaskBarrier,
  markKanbanTaskBarrierAgentCompleted,
  isKanbanTaskBarrierSatisfied,
} = require('../../src/main/kanbanTaskBarrier');

test('barrier is unsatisfied until all expected swarm agents complete', () => {
  let barrier = createKanbanTaskBarrier({ runId: 'run-1', agentIds: ['ceo'] });
  barrier = addKanbanTaskBarrierExpectedAgent(barrier, 'tester');
  assert.equal(isKanbanTaskBarrierSatisfied(barrier), false);

  barrier = markKanbanTaskBarrierAgentCompleted(barrier, 'ceo');
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

test('barrier adds newly involved agents once delegation occurs', () => {
  let barrier = createKanbanTaskBarrier({ runId: 'run-3', agentIds: ['ceo'] });
  barrier = addKanbanTaskBarrierExpectedAgent(barrier, 'tester');
  barrier = addKanbanTaskBarrierExpectedAgent(barrier, 'tester');

  assert.deepEqual(barrier.expectedAgentIds, ['ceo', 'tester']);
});
