const CLI_EVENT_REGEX = /\x1b]777;AO_KANBAN_EVENT:([^\x07\x1b]*)(?:\x07|\x1b\\)/g;

function decodeCliTimelineEvent(encodedPayload) {
  try {
    const payload = Buffer.from(encodedPayload, 'base64').toString('utf8');
    const parsed = JSON.parse(payload);
    return {
      kind: parsed.kind || 'assistant',
      phase: parsed.phase || 'completed',
      title: String(parsed.title || 'Update'),
      text: String(parsed.text || ''),
    };
  } catch {
    return null;
  }
}

function extractCliTimelineEvents(text) {
  const source = String(text || '');
  const events = [];

  const cleanText = source.replace(CLI_EVENT_REGEX, (_, encodedPayload) => {
    const event = decodeCliTimelineEvent(encodedPayload);
    if (event) {
      events.push(event);
    }
    return '';
  });

  return { cleanText, events };
}

module.exports = {
  extractCliTimelineEvents,
};
