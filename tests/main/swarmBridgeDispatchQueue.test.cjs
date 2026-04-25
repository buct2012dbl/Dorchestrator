const test = require('node:test');
const assert = require('node:assert/strict');

const { SwarmBridgeDispatchQueue } = require('../../src/main/swarmBridgeDispatchQueue');

function flushTasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

test('serializes swarm bridge deliveries for the same target agent', async () => {
  const queue = new SwarmBridgeDispatchQueue();
  const events = [];
  let releaseFirst;

  const first = queue.enqueue('ceo', async () => {
    events.push('first:start');
    await new Promise((resolve) => {
      releaseFirst = resolve;
    });
    events.push('first:end');
  });

  const second = queue.enqueue('ceo', async () => {
    events.push('second:start');
    events.push('second:end');
  });

  await flushTasks();
  assert.deepEqual(events, ['first:start']);

  releaseFirst();
  await Promise.all([first, second]);

  assert.deepEqual(events, [
    'first:start',
    'first:end',
    'second:start',
    'second:end',
  ]);
});

test('allows different swarm agents to receive bridge deliveries concurrently', async () => {
  const queue = new SwarmBridgeDispatchQueue();
  const events = [];
  let releaseCeo;
  let releaseProgrammer;

  const ceo = queue.enqueue('ceo', async () => {
    events.push('ceo:start');
    await new Promise((resolve) => {
      releaseCeo = resolve;
    });
    events.push('ceo:end');
  });

  const programmer = queue.enqueue('programmer', async () => {
    events.push('programmer:start');
    await new Promise((resolve) => {
      releaseProgrammer = resolve;
    });
    events.push('programmer:end');
  });

  await flushTasks();
  assert.deepEqual(events, ['ceo:start', 'programmer:start']);

  releaseProgrammer();
  releaseCeo();
  await Promise.all([ceo, programmer]);

  assert.match(events.join(','), /ceo:start,programmer:start/);
});
