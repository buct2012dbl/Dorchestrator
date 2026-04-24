function shouldFailKanbanTaskExecution({ response, error }) {
  if (!error) return false;
  return !response || response === '(no response)';
}

function isGenericUnusableFinalResponseError(error) {
  const clean = String(error || '').trim();
  if (!clean) return false;
  return /^Task failed before producing a usable final response\.?$/i.test(clean);
}

function shouldFailKanbanSwarmExecution({ finalResponse, error, transcriptFailure }) {
  if (finalResponse && finalResponse !== '(no response)') {
    return false;
  }

  if (isGenericUnusableFinalResponseError(error) && !transcriptFailure) {
    return false;
  }

  return Boolean(error || transcriptFailure);
}

module.exports = {
  isGenericUnusableFinalResponseError,
  shouldFailKanbanTaskExecution,
  shouldFailKanbanSwarmExecution,
};
