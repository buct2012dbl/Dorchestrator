const test = require('node:test');
const assert = require('node:assert/strict');

const {
  computeNextScheduledRunAt,
  isOneTimeScheduleExpired,
  normalizeScheduledTask,
} = require('../../src/main/kanbanSchedule');

test('computeNextScheduledRunAt returns the configured one-time timestamp', () => {
  const nextRunAt = computeNextScheduledRunAt({
    id: 'schedule-1',
    scheduleType: 'once',
    runAt: '2026-04-20T10:30:00.000Z',
    enabled: true,
  }, { nowIso: '2026-04-20T09:30:00.000Z' });

  assert.equal(nextRunAt, '2026-04-20T10:30:00.000Z');
});

test('computeNextScheduledRunAt expires one-time schedules after their run time passes', () => {
  const nextRunAt = computeNextScheduledRunAt({
    id: 'schedule-expired',
    scheduleType: 'once',
    runAt: '2026-04-20T10:30:00.000Z',
    enabled: true,
  }, { nowIso: '2026-04-20T10:30:01.000Z' });

  assert.equal(nextRunAt, null);
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

test('isOneTimeScheduleExpired detects a missed one-time schedule', () => {
  assert.equal(isOneTimeScheduleExpired({
    id: 'schedule-missed',
    scheduleType: 'once',
    runAt: '2026-04-20T10:30:00.000Z',
    enabled: true,
  }, { nowIso: '2026-04-20T10:45:00.000Z' }), true);
});
