const test = require('node:test');
const assert = require('node:assert/strict');

const { drainJsonLines } = require('../../src/main/jsonLineBuffer');

test('drainJsonLines returns all complete lines from a single chunk', () => {
  const { lines, rest } = drainJsonLines('{"a":1}\n{"b":2}\n{"c":3}\n');

  assert.deepEqual(lines, ['{"a":1}', '{"b":2}', '{"c":3}']);
  assert.equal(rest, '');
});

test('drainJsonLines preserves an incomplete trailing line for the next chunk', () => {
  const { lines, rest } = drainJsonLines('{"a":1}\n{"b":');

  assert.deepEqual(lines, ['{"a":1}']);
  assert.equal(rest, '{"b":');
});

test('drainJsonLines ignores blank newline-only entries', () => {
  const { lines, rest } = drainJsonLines('\n{"a":1}\n\n');

  assert.deepEqual(lines, ['{"a":1}']);
  assert.equal(rest, '');
});
