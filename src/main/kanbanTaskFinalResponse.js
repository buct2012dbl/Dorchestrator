function isToolCallTranscript(text) {
  const clean = String(text || '').trim();
  if (!clean) return false;

  const patterns = [
    /agent-bridge\s*-\s*send_message/i,
    /agent-bridge\s*-\s*send_response/i,
    /\(MCP\)/i,
    /^\s*REPLY\s*$/im,
    /\*\s*Doing\.\.\./i,
  ];

  return patterns.some((pattern) => pattern.test(clean));
}

function normalizeMeaningfulText(text) {
  const clean = String(text || '').trim();
  if (!clean) return '';
  if (isToolCallTranscript(clean)) return '';
  if (/^task failed before producing a usable final response\.?$/i.test(clean)) return '';
  return clean;
}

function getLatestAssistantTimelineText(run) {
  const timelineEvents = Array.isArray(run?.timelineEvents) ? run.timelineEvents : [];
  for (let index = timelineEvents.length - 1; index >= 0; index -= 1) {
    const event = timelineEvents[index];
    const text = normalizeMeaningfulText(event?.text || '');
    if (!text) continue;
    if (event?.kind === 'assistant') {
      return text;
    }
  }
  return '';
}

function getLatestSegmentText(run) {
  const segments = Array.isArray(run?.segments) ? run.segments : [];
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    const text = normalizeMeaningfulText(segments[index]?.text || '');
    if (text) return text;
  }
  return '';
}

function resolveKanbanTaskFinalResponse({ run, preferredResponse }) {
  const preferred = String(preferredResponse || '').trim();
  const preferredMeaningful = normalizeMeaningfulText(preferred);
  if (preferredMeaningful) return preferredMeaningful;

  const assistantTimelineText = getLatestAssistantTimelineText(run);
  if (assistantTimelineText) return assistantTimelineText;

  const segmentText = getLatestSegmentText(run);
  if (segmentText) return segmentText;

  return preferredMeaningful;
}

module.exports = {
  normalizeMeaningfulText,
  isToolCallTranscript,
  getLatestAssistantTimelineText,
  getLatestSegmentText,
  resolveKanbanTaskFinalResponse,
};
