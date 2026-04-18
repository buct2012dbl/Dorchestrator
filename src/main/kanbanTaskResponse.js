function shouldFailKanbanTaskExecution({ response, error }) {
  if (!error) return false;
  return !response || response === '(no response)';
}

module.exports = {
  shouldFailKanbanTaskExecution,
};
