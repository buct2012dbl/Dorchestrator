const test = require('node:test');
const assert = require('node:assert/strict');

const {
  removeKanbanTasksForDeletedSharedAgent,
  removeKanbanTasksForDeletedSwarm,
} = require('../../src/main/kanbanStateIntegrity');

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

test('removeKanbanTasksForDeletedSwarm removes tasks assigned to a deleted swarm', () => {
  const originalState = {
    selectedView: 'board',
    sidebarCollapsed: false,
    tasks: [
      { id: 'task-swarm-a', targetType: 'swarm', targetId: 'swarm-a', title: 'Remove me' },
      { id: 'task-agent-a', targetType: 'agent', targetId: 'agent-a', title: 'Keep agent task' },
      { id: 'task-swarm-b', targetType: 'swarm', targetId: 'swarm-b', title: 'Keep me' },
    ],
    scheduledTasks: [],
  };

  const { state, removedTasks } = removeKanbanTasksForDeletedSwarm(originalState, 'swarm-a');

  assert.deepEqual(
    removedTasks.map((task) => task.id),
    ['task-swarm-a'],
  );
  assert.deepEqual(
    state.tasks.map((task) => task.id),
    ['task-agent-a', 'task-swarm-b'],
  );
  assert.equal(originalState.tasks.length, 3);
});
