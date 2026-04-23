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

function terminateTimedOutExecProcess(childProcess, options = {}) {
  const {
    label = 'process',
    processError = null,
    graceMs = 1000,
    schedule = setTimeout,
  } = options;

  const { terminated, forceKillTimer } = terminateSpawnedProcess(childProcess, {
    graceMs,
    schedule,
  });

  let nextProcessError = processError;
  if (!terminated && !nextProcessError && childProcess?.exitCode === null && childProcess?.signalCode === null) {
    nextProcessError = `Timed out waiting for ${label} response and failed to terminate the exec process cleanly.`;
  }

  return {
    terminated,
    forceKillTimer,
    processError: nextProcessError,
  };
}

module.exports = {
  terminateSpawnedProcess,
  terminateTimedOutExecProcess,
};
