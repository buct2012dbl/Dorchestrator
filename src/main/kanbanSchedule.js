const SCHEDULE_TYPES = new Set(['once', 'interval']);
const INTERVAL_UNITS = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
};

function toIsoString(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function toPositiveInteger(value, fallback = 1) {
  const nextValue = Number.parseInt(value, 10);
  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : fallback;
}

function normalizeScheduleLog(log = {}) {
  return {
    id: log.id || `schedule-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: toIsoString(log.startedAt),
    completedAt: toIsoString(log.completedAt),
    status: log.status || 'success',
    exitCode: Number.isInteger(log.exitCode) ? log.exitCode : null,
    boardTaskId: log.boardTaskId || null,
    stdout: typeof log.stdout === 'string' ? log.stdout : '',
    stderr: typeof log.stderr === 'string' ? log.stderr : '',
    output: typeof log.output === 'string' ? log.output : '',
    error: log.error || null,
  };
}

function normalizeScheduledTask(task = {}) {
  const now = new Date().toISOString();
  const scheduleType = SCHEDULE_TYPES.has(task.scheduleType) ? task.scheduleType : 'once';
  const intervalUnit = Object.prototype.hasOwnProperty.call(INTERVAL_UNITS, task.intervalUnit)
    ? task.intervalUnit
    : 'hours';
  const normalized = {
    id: task.id || `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: task.name?.trim() || 'Scheduled Task',
    command: typeof task.command === 'string' ? task.command : '',
    scheduleType,
    runAt: toIsoString(task.runAt),
    intervalValue: toPositiveInteger(task.intervalValue, 1),
    intervalUnit,
    enabled: task.enabled !== false,
    createdAt: toIsoString(task.createdAt, now),
    updatedAt: toIsoString(task.updatedAt, now),
    lastRunAt: toIsoString(task.lastRunAt),
    nextRunAt: toIsoString(task.nextRunAt),
    logs: Array.isArray(task.logs) ? task.logs.map(normalizeScheduleLog) : [],
  };

  if (normalized.scheduleType === 'once') {
    normalized.intervalValue = 1;
    normalized.intervalUnit = 'hours';
  }

  return normalized;
}

function getIntervalMs(task = {}) {
  const unitMs = INTERVAL_UNITS[task.intervalUnit] || INTERVAL_UNITS.hours;
  return toPositiveInteger(task.intervalValue, 1) * unitMs;
}

function computeNextScheduledRunAt(task = {}, options = {}) {
  const normalized = normalizeScheduledTask(task);
  const now = options.nowIso ? new Date(options.nowIso) : new Date();
  if (Number.isNaN(now.getTime()) || normalized.enabled === false) {
    return null;
  }

  if (normalized.scheduleType === 'once') {
    if (!normalized.runAt) return null;
    const runAt = new Date(normalized.runAt);
    return Number.isNaN(runAt.getTime()) ? null : runAt.toISOString();
  }

  const intervalMs = getIntervalMs(normalized);
  if (!normalized.lastRunAt && !normalized.nextRunAt) {
    return new Date(now.getTime() + intervalMs).toISOString();
  }

  const baseTime = normalized.lastRunAt || normalized.nextRunAt || normalized.updatedAt || normalized.createdAt;
  const baseDate = new Date(baseTime);
  if (Number.isNaN(baseDate.getTime())) {
    return new Date(now.getTime() + intervalMs).toISOString();
  }

  let nextTime = baseDate.getTime();
  const nowTime = now.getTime();
  if (nextTime <= nowTime) {
    const elapsed = nowTime - nextTime;
    const jumps = Math.floor(elapsed / intervalMs) + 1;
    nextTime += jumps * intervalMs;
  }

  return new Date(nextTime).toISOString();
}

function getScheduleSummary(task = {}) {
  const normalized = normalizeScheduledTask(task);
  if (normalized.scheduleType === 'once') {
    return normalized.runAt ? `One time at ${normalized.runAt}` : 'One time';
  }
  return `Every ${normalized.intervalValue} ${normalized.intervalUnit}`;
}

module.exports = {
  computeNextScheduledRunAt,
  getIntervalMs,
  getScheduleSummary,
  normalizeScheduleLog,
  normalizeScheduledTask,
};
