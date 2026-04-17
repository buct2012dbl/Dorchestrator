const MIN_SPLIT_FRACTION = 0.12;
const GAP = 6;

export function computePanelRects(terminals, containerW, containerH) {
  const rects = {};
  if (!containerW || !containerH || !terminals?.length) return rects;

  terminals.forEach(term => {
    rects[term.id] = {
      left: GAP + term.bounds.x * (containerW - GAP),
      top: GAP + term.bounds.y * (containerH - GAP),
      width: term.bounds.width * (containerW - GAP) - GAP,
      height: term.bounds.height * (containerH - GAP) - GAP,
    };
  });

  return rects;
}

export function createRuntimeTerminals(template) {
  if (template?.runtimeLayout?.terminals?.length) {
    return template.runtimeLayout.terminals.map((termConfig) => ({
      id: `mux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      config: { ...termConfig.config },
      bounds: { ...termConfig.bounds },
      mergePartnerId: null,
      mergeBounds: null,
    }));
  }

  if (!template?.layout) return [];

  const { rows, cols, terminals = [] } = template.layout;
  return terminals.map((termConfig) => ({
    id: `mux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    config: { ...termConfig.config },
    bounds: {
      x: termConfig.col / cols,
      y: termConfig.row / rows,
      width: 1 / cols,
      height: 1 / rows,
    },
    mergePartnerId: null,
    mergeBounds: null,
  }));
}

export function getNextSplitName(baseName, terminals) {
  const fallbackName = baseName || 'Terminal';
  const nameSet = new Set(terminals.map((term) => term.config?.name).filter(Boolean));
  if (!nameSet.has(fallbackName)) return fallbackName;

  let suffix = 2;
  while (nameSet.has(`${fallbackName} ${suffix}`)) {
    suffix += 1;
  }

  return `${fallbackName} ${suffix}`;
}

export function getTemplateSpawnSignature(template) {
  if (!template?.layout) return 'no-template';

  const { rows, cols, terminals = [] } = template.layout;
  return JSON.stringify({
    id: template.id,
    rows,
    cols,
    terminals: terminals.map((term) => ({
      id: term.id,
      row: term.row,
      col: term.col,
      cliType: term.config?.cliType || 'empty',
      model: term.config?.model || '',
      name: term.config?.name || '',
      systemPrompt: term.config?.systemPrompt || '',
    })),
    runtimeLayout: getRuntimeLayoutEntries(template.runtimeLayout),
  });
}

function getRuntimeLayoutEntries(runtimeLayout) {
  return (runtimeLayout?.terminals || []).map((term) => ({
    bounds: term.bounds,
    cliType: term.config?.cliType || 'empty',
    model: term.config?.model || '',
    name: term.config?.name || '',
    systemPrompt: term.config?.systemPrompt || '',
  }));
}

export function getRuntimeLayoutSignature(runtimeLayout) {
  return JSON.stringify(getRuntimeLayoutEntries(runtimeLayout));
}

export function serializeRuntimeLayout(terminals) {
  return {
    terminals: terminals.map((term, index) => ({
      id: `runtime-${index + 1}`,
      bounds: {
        x: term.bounds.x,
        y: term.bounds.y,
        width: term.bounds.width,
        height: term.bounds.height,
      },
      config: { ...term.config },
    })),
  };
}

export function shouldReuseLocalRuntimeTerminals(terminals, template, localRuntimeLayoutSignature) {
  if (!template || terminals.length === 0 || !localRuntimeLayoutSignature) {
    return false;
  }

  return getRuntimeLayoutSignature(template.runtimeLayout) === localRuntimeLayoutSignature;
}

export function clearMergeMetadata(term) {
  return {
    ...term,
    mergePartnerId: null,
    mergeBounds: null,
  };
}

export function canSplitTerminal(term, axis) {
  if (!term) return false;
  const span = axis === 'horizontal' ? term.bounds.height : term.bounds.width;
  return span >= MIN_SPLIT_FRACTION * 2;
}

export function groupTerminalsByRow(terminals) {
  const rows = [];

  terminals.forEach((term) => {
    const matchingRow = rows.find((row) => (
      Math.abs(row.y - term.bounds.y) < 0.0001 &&
      Math.abs(row.height - term.bounds.height) < 0.0001
    ));

    if (matchingRow) {
      matchingRow.terminals.push(term);
      return;
    }

    rows.push({
      y: term.bounds.y,
      height: term.bounds.height,
      terminals: [term],
    });
  });

  return rows
    .sort((a, b) => a.y - b.y)
    .map((row) => ({
      ...row,
      terminals: row.terminals.sort((a, b) => a.bounds.x - b.bounds.x),
    }));
}

export function rebalanceTerminals(terminals) {
  if (terminals.length === 0) return [];

  const rows = groupTerminalsByRow(terminals);
  const rowHeight = 1 / rows.length;

  return rows.flatMap((row, rowIndex) => {
    const width = 1 / row.terminals.length;

    return row.terminals.map((term, columnIndex) => ({
      ...clearMergeMetadata(term),
      bounds: {
        x: columnIndex * width,
        y: rowIndex * rowHeight,
        width,
        height: rowHeight,
      },
    }));
  });
}

export function closeTerminal(terminals, terminalId) {
  const terminalToClose = terminals.find((term) => term.id === terminalId);
  if (!terminalToClose) {
    return { terminals, focusedTerminalId: null };
  }

  const remaining = terminals.filter((term) => term.id !== terminalId);
  const mergePartner = terminalToClose.mergePartnerId
    ? remaining.find((term) => term.id === terminalToClose.mergePartnerId)
    : null;

  if (mergePartner && terminalToClose.mergeBounds) {
    const nextTerminals = remaining.map((term) => (
      term.id === mergePartner.id
        ? {
            ...clearMergeMetadata(term),
            bounds: { ...terminalToClose.mergeBounds },
          }
        : clearMergeMetadata(term)
    ));

    return {
      terminals: nextTerminals,
      focusedTerminalId: mergePartner.id,
    };
  }

  const rebalanced = rebalanceTerminals(remaining);
  return {
    terminals: rebalanced,
    focusedTerminalId: rebalanced[0]?.id || null,
  };
}
