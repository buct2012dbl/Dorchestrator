function buildClaudeBridgeExecArgs({ model, systemPrompt, message, maxTurns = 8 }) {
  const args = ['-p', '--output-format', 'text', '--max-turns', String(maxTurns)];

  if (model) {
    args.push('--model', model);
  }

  if (systemPrompt) {
    args.push('--append-system-prompt', systemPrompt);
  }

  args.push(message);
  return args;
}

module.exports = {
  buildClaudeBridgeExecArgs,
};
