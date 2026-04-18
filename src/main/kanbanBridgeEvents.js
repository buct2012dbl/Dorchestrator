function compactBridgeMessage(message) {
  const text = String(message || '').trim();
  if (!text) return '';
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function buildBridgeTimelineEvents({ kind = 'message', fromName, targetName, message }) {
  const safeFromName = fromName || 'Unknown agent';
  const safeTargetName = targetName || 'Unknown agent';
  const details = compactBridgeMessage(message);

  if (kind === 'response') {
    return {
      senderEvent: {
        kind: 'assistant',
        phase: 'completed',
        title: `Sent response to ${safeTargetName}`,
        text: details,
      },
      targetEvent: {
        kind: 'assistant',
        phase: 'completed',
        title: `Received response from ${safeFromName}`,
        text: details,
      },
    };
  }

  return {
    senderEvent: {
      kind: 'command',
      phase: 'running',
      title: `Delegated task to ${safeTargetName}`,
      text: details,
    },
    targetEvent: {
      kind: 'command',
      phase: 'running',
      title: `Received delegated task from ${safeFromName}`,
      text: details,
    },
  };
}

module.exports = {
  buildBridgeTimelineEvents,
};
