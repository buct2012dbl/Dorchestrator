export const CLAUDE_MODELS = [
  'claude-opus-4-6',
  'claude-sonnet-4-6',
  'claude-haiku-4-5-20251001',
];

export const CODEX_MODELS = [
  'gpt-5.1',
  'gpt-5.2',
  'gpt-5.3',
  'gpt-5.4'
];

export const CODING_AGENT_MODELS = [
  'gpt-5.4',
];

export function getModelsForTerminalType(terminalType) {
  if (terminalType === 'codex') return CODEX_MODELS;
  if (terminalType === 'coding-agent') return CODING_AGENT_MODELS;
  return CLAUDE_MODELS;
}

export function getDefaultModelForTerminalType(terminalType) {
  if (terminalType === 'codex') return 'o4-mini';
  if (terminalType === 'coding-agent') return 'gpt-5.4';
  return 'claude-sonnet-4-6';
}
