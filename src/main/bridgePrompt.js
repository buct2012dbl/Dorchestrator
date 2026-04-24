function buildBridgeDeliveryMessage({ kind = 'message', fromName, message }) {
  const safeFromName = String(fromName || 'Unknown agent').trim() || 'Unknown agent';
  const body = String(message || '').trim();

  if (kind === 'response') {
    return [
      `[Response from ${safeFromName}]:`,
      body,
      '',
      'This is the final response to your earlier delegation.',
      'Treat it as context or a result, not as a new task.',
      'Do not send a response back unless you have a concrete follow-up request.',
    ].filter(Boolean).join('\n');
  }

  return [
    `[Message from ${safeFromName}]:`,
    body,
    '',
    'This is a delegated task.',
    'When you are ready, reply with send_response to the original sender.',
  ].filter(Boolean).join('\n');
}

function formatBridgePromptForTerminal(message) {
  const normalized = String(message || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return '';
  }

  return normalized.join(' ');
}

module.exports = {
  buildBridgeDeliveryMessage,
  formatBridgePromptForTerminal,
};
