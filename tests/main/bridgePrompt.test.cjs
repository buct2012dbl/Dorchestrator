const test = require('node:test');
const assert = require('node:assert/strict');

const { formatBridgePromptForClaude } = require('../../src/main/bridgePrompt');

test('formatBridgePromptForClaude flattens multiline bridge payloads into a submit-safe prompt', () => {
  const result = formatBridgePromptForClaude(`
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

test('formatBridgePromptForClaude returns empty string for whitespace-only payloads', () => {
  assert.equal(formatBridgePromptForClaude(' \n\t\r\n '), '');
});

test('formatBridgePromptForClaude preserves response prefix at the start of the prompt', () => {
  const result = formatBridgePromptForClaude(`
    [Response from Tester]:

    Fixed the failing test and confirmed the new path.
  `);

  assert.equal(
    result,
    '[Response from Tester]: Fixed the failing test and confirmed the new path.'
  );
});
