function formatBridgePromptForClaude(message) {
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
  formatBridgePromptForClaude,
};
