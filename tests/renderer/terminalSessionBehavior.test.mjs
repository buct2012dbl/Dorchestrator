import test from 'node:test';
import assert from 'node:assert/strict';
import { getTerminalInputAction } from '../../src/renderer/components/terminalSessionBehavior.mjs';

test('restarts on keypress after exit when restart is enabled', () => {
  const action = getTerminalInputAction({
    ptyAlive: false,
    restartOnExit: true,
    canSpawn: true,
    data: 'x',
  });

  assert.deepEqual(action, { type: 'restart' });
});

test('ignores input after exit when restart is disabled', () => {
  const action = getTerminalInputAction({
    ptyAlive: false,
    restartOnExit: false,
    canSpawn: true,
    data: 'x',
  });

  assert.deepEqual(action, { type: 'ignore' });
});

test('filters initialization escape sequences before PTY input forwarding', () => {
  const action = getTerminalInputAction({
    ptyAlive: true,
    restartOnExit: true,
    canSpawn: true,
    data: '\u001b[?1;2c',
    shouldIgnoreInput: (value) => value.match(/^\x1b\[\?1;/),
  });

  assert.deepEqual(action, { type: 'ignore' });
});

test('forwards regular input to the PTY while alive', () => {
  const action = getTerminalInputAction({
    ptyAlive: true,
    restartOnExit: true,
    canSpawn: true,
    data: 'ls -la\r',
  });

  assert.deepEqual(action, { type: 'input' });
});
