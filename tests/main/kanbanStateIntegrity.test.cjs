const test = require('node:test');
const assert = require('node:assert/strict');

const { removeKanbanTasksForDeletedSharedAgent } = require('../../src/main/kanbanStateIntegrity');

test('removeKanbanTasksForDeletedSharedAgent removes tasks assigned to a deleted shared agent', () => {
  const originalState = {
    selectedView: 'board',
    sidebarCollapsed: false,
    tasks: [
      { id: 'task-agent-a', targetType: 'agent', targetId: 'agent-a', title: 'Remove me' },
      { id: 'task-agent-b', targetType: 'agent', targetId: 'agent-b', title: 'Keep me' },
      { id: 'task-swarm', targetType: 'swarm', targetId: 'swarm-1', title: 'Keep swarm task' },
    ],
    scheduledTasks: [],
  };

  const { state, removedTasks } = removeKanbanTasksForDeletedSharedAgent(originalState, 'agent-a');

  assert.deepEqual(
    removedTasks.map((task) => task.id),
    ['task-agent-a'],
  );
  assert.deepEqual(
    state.tasks.map((task) => task.id),
    ['task-agent-b', 'task-swarm'],
  );
  assert.equal(originalState.tasks.length, 3);
});

test('removeKanbanTasksForDeletedSharedAgent leaves state unchanged when no tasks reference the deleted agent', () => {
  const originalState = {
    selectedView: 'board',
    sidebarCollapsed: false,
    tasks: [
      { id: 'task-agent-b', targetType: 'agent', targetId: 'agent-b' },
    ],
    scheduledTasks: [],
  };

  const { state, removedTasks } = removeKanbanTasksForDeletedSharedAgent(originalState, 'agent-a');

  assert.equal(state, originalState);
  assert.deepEqual(removedTasks, []);
});
