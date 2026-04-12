import test from 'node:test';
import assert from 'node:assert/strict';
import {
  closeTerminal,
  computePanelRects,
  rebalanceTerminals,
  serializeRuntimeLayout,
} from '../../src/renderer/components/mux/muxLayout.mjs';

test('rebalanceTerminals preserves row-scoped fills instead of collapsing all rows together', () => {
  const terminals = [
    { id: 'top-left', bounds: { x: 0, y: 0, width: 0.5, height: 0.5 }, config: {} },
    { id: 'top-right', bounds: { x: 0.5, y: 0, width: 0.5, height: 0.5 }, config: {} },
    { id: 'bottom', bounds: { x: 0, y: 0.5, width: 1, height: 0.5 }, config: {} },
  ];

  const next = rebalanceTerminals(terminals.filter((term) => term.id !== 'top-right'));

  assert.equal(next.length, 2);
  assert.deepEqual(next[0].bounds, { x: 0, y: 0, width: 1, height: 0.5 });
  assert.deepEqual(next[1].bounds, { x: 0, y: 0.5, width: 1, height: 0.5 });
});

test('closeTerminal restores merge partner bounds for split terminals', () => {
  const terminals = [
    {
      id: 'left',
      bounds: { x: 0, y: 0, width: 0.5, height: 1 },
      config: { name: 'Left' },
      mergePartnerId: 'right',
      mergeBounds: { x: 0, y: 0, width: 1, height: 1 },
    },
    {
      id: 'right',
      bounds: { x: 0.5, y: 0, width: 0.5, height: 1 },
      config: { name: 'Right' },
      mergePartnerId: 'left',
      mergeBounds: { x: 0, y: 0, width: 1, height: 1 },
    },
  ];

  const nextState = closeTerminal(terminals, 'right');

  assert.equal(nextState.focusedTerminalId, 'left');
  assert.equal(nextState.terminals.length, 1);
  assert.deepEqual(nextState.terminals[0].bounds, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(nextState.terminals[0].mergePartnerId, null);
});

test('serializeRuntimeLayout produces stable saved terminal records', () => {
  const terminals = [
    {
      id: 'mux-1',
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      config: { name: 'Editor', cliType: 'shell' },
    },
  ];

  assert.deepEqual(serializeRuntimeLayout(terminals), {
    terminals: [
      {
        id: 'runtime-1',
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        config: { name: 'Editor', cliType: 'shell' },
      },
    ],
  });
});

test('computePanelRects keeps panel gaps consistent inside the container', () => {
  const rects = computePanelRects([
    { id: 'term-1', bounds: { x: 0, y: 0, width: 0.5, height: 1 } },
  ], 1000, 600);

  assert.deepEqual(rects['term-1'], {
    left: 6,
    top: 6,
    width: 491,
    height: 588,
  });
});
