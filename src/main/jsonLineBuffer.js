function drainJsonLines(buffer = '') {
  const lines = [];
  let rest = buffer;
  let newlineIdx;

  while ((newlineIdx = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, newlineIdx).trim();
    rest = rest.slice(newlineIdx + 1);
    if (line) {
      lines.push(line);
    }
  }

  return { lines, rest };
}

module.exports = {
  drainJsonLines,
};
