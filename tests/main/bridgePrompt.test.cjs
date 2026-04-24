const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBridgeDeliveryMessage,
  formatBridgePromptForTerminal,
} = require('../../src/main/bridgePrompt');

test('buildBridgeDeliveryMessage marks delegated work as something that should be answered via send_response', () => {
  const result = buildBridgeDeliveryMessage({
    kind: 'message',
    fromName: 'CEO',
    message: 'Please inspect the parser bug.',
  });

  assert.match(result, /^\[Message from CEO\]:/);
  assert.match(result, /This is a delegated task\./);
  assert.match(result, /reply with send_response to the original sender\./);
});

test('buildBridgeDeliveryMessage marks responses as terminal context instead of new work', () => {
  const result = buildBridgeDeliveryMessage({
    kind: 'response',
    fromName: 'Programmer',
    message: 'I said hello and finished.',
  });

  assert.match(result, /^\[Response from Programmer\]:/);
  assert.match(result, /Treat it as context or a result, not as a new task\./);
  assert.match(result, /Do not send a response back unless you have a concrete follow-up request\./);
});

test('formatBridgePromptForTerminal flattens multiline bridge payloads into a submit-safe prompt', () => {
  const result = formatBridgePromptForTerminal(`
    [Message from CEO]:

    Please check:
      - why Claude stalls
      - whether blank lines are injected

    Reply through send_response.
  `);

  assert.equal(
    result,
    '[Message from CEO]: Please check: - why Claude stalls - whether blank lines are injected Reply through send_response.'
  );
});

test('formatBridgePromptForTerminal returns empty string for whitespace-only payloads', () => {
  assert.equal(formatBridgePromptForTerminal(' \n\t\r\n '), '');
});

test('formatBridgePromptForTerminal preserves response prefix at the start of the prompt', () => {
  const result = formatBridgePromptForTerminal(buildBridgeDeliveryMessage({
    kind: 'response',
    fromName: 'Tester',
    message: 'Fixed the failing test and confirmed the new path.',
  }));

  assert.match(result, /^\[Response from Tester\]:/);
  assert.match(result, /Fixed the failing test and confirmed the new path\./);
  assert.match(result, /Do not send a response back unless you have a concrete follow-up request\./);
});
