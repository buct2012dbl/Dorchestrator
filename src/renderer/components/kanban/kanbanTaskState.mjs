export function getRunStatusForStageMove(task, stage) {
  if (stage === 'done') {
    return 'idle';
  }

  return task.runStatus;
}
