const test = require('node:test');
const assert = require('node:assert/strict');

const { buildClaudeBridgeExecArgs } = require('../../src/main/claudeBridgeExec');

test('buildClaudeBridgeExecArgs configures Claude print mode with system prompt and model', () => {
  const args = buildClaudeBridgeExecArgs({
    model: 'claude-sonnet-4-6',
    systemPrompt: 'You are a programmer.',
    message: 'Incoming message from Tester [agent-t]: run checks.',
    maxTurns: 5,
  });

  assert.deepEqual(args, [
    '-p',
    '--output-format',
    'text',
    '--max-turns',
    '5',
    '--model',
    'claude-sonnet-4-6',
    '--append-system-prompt',
    'You are a programmer.',
    'Incoming message from Tester [agent-t]: run checks.',
  ]);
});

test('buildClaudeBridgeExecArgs omits optional flags when not provided', () => {
  const args = buildClaudeBridgeExecArgs({
    message: 'Incoming response from CEO [agent-ceo]: proceed.',
  });

  assert.deepEqual(args, [
    '-p',
    '--output-format',
    'text',
    '--max-turns',
    '8',
    'Incoming response from CEO [agent-ceo]: proceed.',
  ]);
});
