function terminateSpawnedProcess(childProcess, options = {}) {
  const {
    graceMs = 1000,
    schedule = setTimeout,
  } = options;

  if (!childProcess || childProcess.exitCode !== null || childProcess.signalCode !== null) {
    return { terminated: false, forceKillTimer: null };
  }

  let terminated = false;
  try {
    terminated = childProcess.kill('SIGTERM');
  } catch {
    terminated = false;
  }

  const forceKillTimer = schedule(() => {
    if (!childProcess || childProcess.exitCode !== null || childProcess.signalCode !== null) {
      return;
    }
    try {
      childProcess.kill('SIGKILL');
    } catch {}
  }, graceMs);

  if (typeof forceKillTimer?.unref === 'function') {
    forceKillTimer.unref();
  }

  return { terminated, forceKillTimer };
}

module.exports = {
  terminateSpawnedProcess,
};
