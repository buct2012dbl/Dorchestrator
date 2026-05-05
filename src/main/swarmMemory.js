const MAX_SWARM_MEMORY_ENTRIES = 200;
const DEFAULT_PROMPT_ENTRY_LIMIT = 30;

function trimEntries(entries, limit = MAX_SWARM_MEMORY_ENTRIES) {
  if (!Array.isArray(entries)) {
    return [];
  }
  if (entries.length <= limit) {
    return entries;
  }
  return entries.slice(entries.length - limit);
}

function appendAgentMemoryEvent(histories, agentId, entry, limit = MAX_SWARM_MEMORY_ENTRIES) {
  if (!histories || !agentId || !entry) {
    return histories;
  }

  const current = Array.isArray(histories[agentId]) ? histories[agentId] : [];
  histories[agentId] = trimEntries([...current, entry], limit);
  return histories;
}

function buildSummary({ direction, kind, counterpartName, counterpartAgentId, message }) {
  const other = counterpartName
    ? `${counterpartName}${counterpartAgentId ? ` (${counterpartAgentId})` : ''}`
    : (counterpartAgentId || 'unknown agent');
  const action = kind === 'response' ? 'response' : 'message';
  return `${direction === 'sent' ? 'Sent' : 'Received'} ${action} ${direction === 'sent' ? 'to' : 'from'} ${other}: ${message}`;
}

function createEntry({ timestamp, direction, kind, counterpartAgentId, counterpartName, message }) {
  return {
    timestamp: timestamp || new Date().toISOString(),
    direction,
    kind,
    counterpartAgentId: counterpartAgentId || null,
    counterpartName: counterpartName || null,
    message,
    summary: buildSummary({ direction, kind, counterpartName, counterpartAgentId, message }),
  };
}

function appendBridgeExchange(histories, {
  fromAgentId,
  fromName,
  targetAgentId,
  targetName,
  message,
  kind = 'message',
  timestamp,
}) {
  if (!histories || !fromAgentId || !targetAgentId || !message) {
    return histories;
  }

  appendAgentMemoryEvent(histories, fromAgentId, createEntry({
    timestamp,
    direction: 'sent',
    kind,
    counterpartAgentId: targetAgentId,
    counterpartName: targetName,
    message,
  }));

  appendAgentMemoryEvent(histories, targetAgentId, createEntry({
    timestamp,
    direction: 'received',
    kind,
    counterpartAgentId: fromAgentId,
    counterpartName: fromName,
    message,
  }));

  return histories;
}

function buildMemoryPrompt(agentId, histories, options = {}) {
  const entries = Array.isArray(histories?.[agentId]) ? histories[agentId] : [];
  if (entries.length === 0) {
    return '';
  }

  const maxEntries = options.maxEntries || DEFAULT_PROMPT_ENTRY_LIMIT;
  const lines = trimEntries(entries, maxEntries)
    .map((entry) => {
      if (!entry?.message) {
        return null;
      }

      const timestamp = entry?.timestamp ? `[${entry.timestamp}] ` : '';
      const counterpartName = entry.counterpartName || entry.counterpartAgentId || 'another agent';
      const action = entry.kind === 'response' ? 'response' : 'message';

      if (entry.direction === 'received') {
        return `- ${timestamp}${counterpartName} sent you a ${action}: ${entry.message}`;
      }

      return `- ${timestamp}You sent ${counterpartName} a ${action}: ${entry.message}`;
    })
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
  appendBridgeExchange,
  buildMemoryPrompt,
};
