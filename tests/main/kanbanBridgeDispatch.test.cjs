const test = require('node:test');
const assert = require('node:assert/strict');

const { shouldAutoDispatchBridgeDelivery } = require('../../src/main/kanbanBridgeDispatch');

test('Kanban response deliveries do not start a new execution round for the original sender', () => {
  assert.equal(
    shouldAutoDispatchBridgeDelivery({
      kind: 'response',
      targetTaskId: 'task-123',
    }),
    false,
  );
});

test('delegated messages still auto-dispatch during Kanban runs', () => {
  assert.equal(
    shouldAutoDispatchBridgeDelivery({
      kind: 'message',
      targetTaskId: 'task-123',
    }),
    true,
  );
});

test('non-Kanban response deliveries still auto-dispatch', () => {
  assert.equal(
    shouldAutoDispatchBridgeDelivery({
      kind: 'response',
      targetTaskId: null,
    }),
    true,
  );
});
