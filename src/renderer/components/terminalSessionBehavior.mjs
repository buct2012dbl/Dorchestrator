export function getTerminalInputAction({
  ptyAlive,
  restartOnExit = true,
  canSpawn = true,
  data,
  shouldIgnoreInput,
}) {
  if (!ptyAlive) {
    if (!restartOnExit || !canSpawn) {
      return { type: 'ignore' };
    }
    return { type: 'restart' };
  }

  if (shouldIgnoreInput?.(data)) {
    return { type: 'ignore' };
  }

  return { type: 'input' };
}
