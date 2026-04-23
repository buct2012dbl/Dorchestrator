const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildBridgeDisplayMessage,
  buildBridgePrompt,
  normalizeBridgePromptText,
} = require('../../src/main/bridgeMessaging');

test('normalizeBridgePromptText collapses multiline terminal content into a single safe line', () => {
  const normalized = normalizeBridgePromptText('Line one\n\n  Line two\r\n\x1b[31mred\x1b[0m');

  assert.equal(normalized, 'Line one Line two red');
});

test('buildBridgePrompt creates a single-line actionable prompt for incoming messages', () => {
  const prompt = buildBridgePrompt({
    kind: 'message',
    fromName: 'Researcher',
    fromAgentId: 'agent-r',
    message: 'Please inspect:\n- file A\n- file B',
  });

  assert.equal(prompt.includes('\n'), false);
  assert.match(prompt, /Incoming message from Researcher \[agent-r\]: Please inspect: - file A - file B/);
  assert.match(prompt, /reply exactly once using send_response to agent-r/);
});

test('buildBridgePrompt delivers responses as real follow-up input without requiring an acknowledgement', () => {
  const prompt = buildBridgePrompt({
    kind: 'response',
    fromName: 'Programmer',
    fromAgentId: 'agent-p',
    message: 'Patched the timeout leak.',
  });

  assert.equal(prompt.includes('\n'), false);
  assert.match(prompt, /Incoming response from Programmer \[agent-p\]: Patched the timeout leak\./);
  assert.match(prompt, /Continue your current task using this information\./);
  assert.match(prompt, /Do not send an acknowledgement unless you need specific follow-up from agent-p\./);
});

test('buildBridgeDisplayMessage preserves the visible bridge banner text', () => {
  assert.equal(
    buildBridgeDisplayMessage({ kind: 'response', fromName: 'Tester', message: 'Looks good.' }),
    '[Response from Tester]: Looks good.',
  );
});
