function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function removeKanbanTasksForDeletedSharedAgent(state, agentId) {
  if (!agentId) {
    return {
      state,
      removedTasks: [],
    };
  }

  const removedTasks = [];
  const nextTasks = [];

  for (const task of state?.tasks || []) {
    if (task?.targetType === 'agent' && task?.targetId === agentId) {
      removedTasks.push(clone(task));
      continue;
    }
    nextTasks.push(task);
  }

  if (removedTasks.length === 0) {
    return {
      state,
      removedTasks,
    };
  }

  return {
    state: {
      ...state,
      tasks: nextTasks,
    },
    removedTasks,
  };
}

function removeKanbanTasksForDeletedSwarm(state, swarmId) {
  if (!swarmId) {
    return {
      state,
      removedTasks: [],
    };
  }

  const removedTasks = [];
  const nextTasks = [];

  for (const task of state?.tasks || []) {
    if (task?.targetType === 'swarm' && task?.targetId === swarmId) {
      removedTasks.push(clone(task));
      continue;
    }
    nextTasks.push(task);
  }

  if (removedTasks.length === 0) {
    return {
      state,
      removedTasks,
    };
  }

  return {
    state: {
      ...state,
      tasks: nextTasks,
    },
    removedTasks,
  };
}

module.exports = {
  removeKanbanTasksForDeletedSharedAgent,
  removeKanbanTasksForDeletedSwarm,
};
