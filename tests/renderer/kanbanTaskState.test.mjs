import test from 'node:test';
import assert from 'node:assert/strict';
import { getRunStatusForStageMove } from '../../src/renderer/components/kanban/kanbanTaskState.mjs';

test('moving an awaiting review card into done resets the badge state to idle', () => {
  assert.equal(
    getRunStatusForStageMove({ runStatus: 'awaiting_review' }, 'done'),
    'idle',
  );
});

test('moving a card into other stages preserves its current run status', () => {
  assert.equal(
    getRunStatusForStageMove({ runStatus: 'awaiting_review' }, 'todo'),
    'awaiting_review',
  );
});
