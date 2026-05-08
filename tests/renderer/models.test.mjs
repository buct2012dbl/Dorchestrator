import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CODEX_MODELS,
  getDefaultModelForTerminalType,
  getModelsForTerminalType,
} from '../../src/renderer/constants/models.js';

test('codex model options include gpt-5.5', () => {
  assert.ok(CODEX_MODELS.includes('gpt-5.5'));
  assert.ok(getModelsForTerminalType('codex').includes('gpt-5.5'));
});

test('codex default model is gpt-5.5', () => {
  assert.equal(getDefaultModelForTerminalType('codex'), 'gpt-5.5');
});
