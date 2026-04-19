const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeNextScheduledRunAt,
  normalizeScheduledTask,
} = require('../../src/main/kanbanSchedule');

test('computeNextScheduledRunAt returns the configured one-time timestamp', () => {
  const nextRunAt = computeNextScheduledRunAt({
    id: 'schedule-1',
    scheduleType: 'once',
    runAt: '2026-04-20T10:30:00.000Z',
    enabled: true,
  });

  assert.equal(nextRunAt, '2026-04-20T10:30:00.000Z');
});

test('computeNextScheduledRunAt advances recurring schedules after the last run', () => {
  const nextRunAt = computeNextScheduledRunAt({
    id: 'schedule-2',
    scheduleType: 'interval',
    intervalValue: 2,
    intervalUnit: 'hours',
    lastRunAt: '2026-04-20T10:00:00.000Z',
    enabled: true,
  }, { nowIso: '2026-04-20T11:15:00.000Z' });

  assert.equal(nextRunAt, '2026-04-20T12:00:00.000Z');
});

test('normalizeScheduledTask keeps persisted execution logs', () => {
  const task = normalizeScheduledTask({
    id: 'schedule-3',
    name: 'Nightly lint',
    command: 'npm test',
    scheduleType: 'interval',
    intervalValue: 1,
    intervalUnit: 'days',
    logs: [{ id: 'log-1', output: 'done', status: 'success' }],
  });

  assert.equal(task.logs.length, 1);
  assert.equal(task.logs[0].id, 'log-1');
  assert.equal(task.logs[0].output, 'done');
});
