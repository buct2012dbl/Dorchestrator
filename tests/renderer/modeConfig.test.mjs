import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODE, MODE_OPTIONS } from '../../src/renderer/modeConfig.mjs';

test('kanban is the default app mode', () => {
  assert.equal(DEFAULT_MODE, 'kanban');
});

test('kanban is rendered first in the mode switcher options', () => {
  assert.deepEqual(
    MODE_OPTIONS.map((option) => option.id),
    ['kanban', 'swarm', 'mux'],
  );
});
