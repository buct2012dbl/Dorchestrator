function stripAnsiAndControl(text) {
  return String(text || '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[()][0-9A-Za-z]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/\r/g, '\n')
    .trim();
}

function normalizeBridgePromptText(text) {
  return stripAnsiAndControl(text)
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function buildBridgeDisplayMessage({ kind = 'message', fromName, message }) {
  return kind === 'response'
    ? `[Response from ${fromName}]: ${message}`
    : `[Message from ${fromName}]: ${message}`;
}

function buildBridgePrompt({ kind = 'message', fromName, fromAgentId, message }) {
  const safeFromName = normalizeBridgePromptText(fromName || fromAgentId || 'another agent');
  const safeFromAgentId = normalizeBridgePromptText(fromAgentId || safeFromName);
  const safeMessage = normalizeBridgePromptText(message || '');

  if (kind === 'response') {
    return `Incoming response from ${safeFromName} [${safeFromAgentId}]: ${safeMessage} Continue your current task using this information. Do not send an acknowledgement unless you need specific follow-up from ${safeFromAgentId}.`;
  }

  return `Incoming message from ${safeFromName} [${safeFromAgentId}]: ${safeMessage} Handle this request and reply exactly once using send_response to ${safeFromAgentId}.`;
}

module.exports = {
  buildBridgeDisplayMessage,
  buildBridgePrompt,
  normalizeBridgePromptText,
  stripAnsiAndControl,
};
