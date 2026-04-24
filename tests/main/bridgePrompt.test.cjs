const test = require('node:test');
const assert = require('node:assert/strict');

const { formatBridgePromptForTerminal } = require('../../src/main/bridgePrompt');

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
  const result = formatBridgePromptForTerminal(`
    [Response from Tester]:

    Fixed the failing test and confirmed the new path.
  `);

  assert.equal(
    result,
    '[Response from Tester]: Fixed the failing test and confirmed the new path.'
  );
});
