const test = require('node:test');
const assert = require('node:assert/strict');
const {
  terminateSpawnedProcess,
  terminateTimedOutExecProcess,
} = require('../../src/main/childProcessCleanup');

test('terminateSpawnedProcess sends SIGTERM and schedules SIGKILL fallback until exit', () => {
  const signals = [];
  let scheduledCallback = null;
  const childProcess = {
    exitCode: null,
    signalCode: null,
    kill(signal) {
      signals.push(signal);
      return true;
    },
  };

  const timer = { unrefCalled: false, unref() { this.unrefCalled = true; } };
  const result = terminateSpawnedProcess(childProcess, {
    graceMs: 250,
    schedule(callback, delay) {
      scheduledCallback = callback;
      assert.equal(delay, 250);
      return timer;
    },
  });

  assert.equal(result.terminated, true);
  assert.equal(result.forceKillTimer, timer);
  assert.equal(timer.unrefCalled, true);
  assert.deepEqual(signals, ['SIGTERM']);

  scheduledCallback();
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});

test('terminateSpawnedProcess skips already-exited processes', () => {
  const childProcess = {
    exitCode: 0,
    signalCode: null,
    kill() {
      throw new Error('kill should not be called');
    },
  };

  const result = terminateSpawnedProcess(childProcess, {
    schedule() {
      throw new Error('schedule should not be called');
    },
  });

  assert.deepEqual(result, { terminated: false, forceKillTimer: null });
});

test('terminateSpawnedProcess does not force-kill once the process has exited', () => {
  const signals = [];
  let scheduledCallback = null;
  const childProcess = {
    exitCode: null,
    signalCode: null,
    kill(signal) {
      signals.push(signal);
      return true;
    },
  };

  terminateSpawnedProcess(childProcess, {
    schedule(callback) {
      scheduledCallback = callback;
      return { unref() {} };
    },
  });

  childProcess.signalCode = 'SIGTERM';
  scheduledCallback();

  assert.deepEqual(signals, ['SIGTERM']);
});

test('terminateTimedOutExecProcess reports cleanup failure when the exec process cannot be terminated', () => {
  const childProcess = {
    exitCode: null,
    signalCode: null,
    kill() {
      return false;
    },
  };

  const result = terminateTimedOutExecProcess(childProcess, {
    label: 'Codex',
    schedule() {
      return { unref() {} };
    },
  });

  assert.equal(result.terminated, false);
  assert.equal(
    result.processError,
    'Timed out waiting for Codex response and failed to terminate the exec process cleanly.',
  );
});

test('terminateTimedOutExecProcess preserves an existing process error', () => {
  const childProcess = {
    exitCode: null,
    signalCode: null,
    kill() {
      return true;
    },
  };

  const result = terminateTimedOutExecProcess(childProcess, {
    label: 'Codex',
    processError: 'stderr failed first',
    schedule() {
      return { unref() {} };
    },
  });

  assert.equal(result.terminated, true);
  assert.equal(result.processError, 'stderr failed first');
});
