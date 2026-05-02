const DEFAULT_REPLAY_ENTRY_LIMIT = 12;

function trimEntries(entries, limit = DEFAULT_REPLAY_ENTRY_LIMIT) {
  if (!Array.isArray(entries)) {
    return [];
  }
  if (entries.length <= limit) {
    return entries;
  }
  return entries.slice(entries.length - limit);
}

function buildReplayLine(entry) {
  if (!entry?.message) {
    return null;
  }

  const counterpartName = entry.counterpartName || entry.counterpartAgentId || 'another agent';
  const action = entry.kind === 'response' ? 'response' : 'message';

  if (entry.direction === 'received') {
    return `- ${counterpartName} sent you a ${action}: ${entry.message}`;
  }

  return `- You sent ${counterpartName} a ${action}: ${entry.message}`;
}

function buildSessionReplayPrompt(agentId, histories, options = {}) {
  const entries = Array.isArray(histories?.[agentId]) ? histories[agentId] : [];
  if (entries.length === 0) {
    return '';
  }

  const maxEntries = options.maxEntries || DEFAULT_REPLAY_ENTRY_LIMIT;
  const lines = trimEntries(entries, maxEntries)
    .map(buildReplayLine)
    .filter(Boolean);

  if (lines.length === 0) {
    return '';
  }

  return [
    'Restore this prior swarm conversation history into the current session context.',
    'These are genuine earlier exchanges involving you in this workspace.',
    'Use them as existing thread memory when answering future questions.',
    ...lines,
    'Do not mention this restoration step unless the user explicitly asks about it.',
  ].join('\n');
}

module.exports = {
  buildSessionReplayPrompt,
};
