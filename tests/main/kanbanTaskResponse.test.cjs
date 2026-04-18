const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldFailKanbanTaskExecution } = require('../../src/main/kanbanTaskResponse');

test('fails Kanban execution when an error arrives with no usable response', () => {
  assert.equal(
    shouldFailKanbanTaskExecution({
      response: '(no response)',
      error: 'Task failed before producing a usable final response.',
    }),
    true,
  );
});

test('does not fail Kanban execution when a usable response exists despite warning metadata', () => {
  assert.equal(
    shouldFailKanbanTaskExecution({
      response: 'Finished the task.',
      error: 'non-fatal warning',
    }),
    false,
  );
});
