import React, { useState, useEffect, useRef } from 'react';
import MuxTerminalPanel from './MuxTerminalPanel';
import './MuxTerminalView.css';

const GAP = 6;
const MIN_SPLIT_FRACTION = 0.12;

function computePanelRects(terminals, containerW, containerH) {
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

function createRuntimeTerminals(template) {
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

function getNextSplitName(baseName, terminals) {
  const fallbackName = baseName || 'Terminal';
  const nameSet = new Set(terminals.map((term) => term.config?.name).filter(Boolean));
  if (!nameSet.has(fallbackName)) return fallbackName;

  let suffix = 2;
  while (nameSet.has(`${fallbackName} ${suffix}`)) {
    suffix += 1;
  }

  return `${fallbackName} ${suffix}`;
}

function getTemplateSpawnSignature(template) {
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
  });
}

function clearMergeMetadata(term) {
  return {
    ...term,
    mergePartnerId: null,
    mergeBounds: null,
  };
}

function canSplitTerminal(term, axis) {
  if (!term) return false;
  const span = axis === 'horizontal' ? term.bounds.height : term.bounds.width;
  return span >= MIN_SPLIT_FRACTION * 2;
}

function groupTerminalsByRow(terminals) {
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

function rebalanceTerminals(terminals) {
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

function MuxTerminalView({ template, active = true, onEditTemplate }) {
  const [terminals, setTerminals] = useState([]);
  const [focusedTerminalId, setFocusedTerminalId] = useState(null);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const spawnSignature = getTemplateSpawnSignature(template);

  useEffect(() => {
    if (!template) {
      setTerminals([]);
      setFocusedTerminalId(null);
      return;
    }

    const newTerminals = createRuntimeTerminals(template);
    setTerminals(newTerminals);
    setFocusedTerminalId(newTerminals[0]?.id || null);
  }, [spawnSignature, template]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!active) return undefined;

    const handleKeyDown = (event) => {
      const isSplitShortcut = (event.metaKey || event.ctrlKey) && event.shiftKey;
      if (!isSplitShortcut) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleSplit('vertical', 'left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleSplit('vertical', 'right');
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleSplit('horizontal', 'up');
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleSplit('horizontal', 'down');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, focusedTerminalId, terminals]);

  useEffect(() => {
    if (!focusedTerminalId) return;
    if (!terminals.some((term) => term.id === focusedTerminalId)) {
      setFocusedTerminalId(terminals[0]?.id || null);
    }
  }, [focusedTerminalId, terminals]);

  const handleFocusTerminal = (terminalId) => {
    setFocusedTerminalId(terminalId);
  };

  const handleCloseTerminal = (terminalId) => {
    setTerminals((prev) => {
      const terminalToClose = prev.find((term) => term.id === terminalId);
      if (!terminalToClose) return prev;

      const remaining = prev.filter((term) => term.id !== terminalId);
      const mergePartner = terminalToClose.mergePartnerId
        ? remaining.find((term) => term.id === terminalToClose.mergePartnerId)
        : null;

      if (mergePartner && terminalToClose.mergeBounds) {
        setFocusedTerminalId(mergePartner.id);
        return remaining.map((term) => (
          term.id === mergePartner.id
            ? {
                ...clearMergeMetadata(term),
                bounds: { ...terminalToClose.mergeBounds },
              }
            : clearMergeMetadata(term)
        ));
      }

      const rebalanced = rebalanceTerminals(remaining);
      setFocusedTerminalId((currentFocusedId) => (
        currentFocusedId === terminalId ? rebalanced[0]?.id || null : currentFocusedId
      ));
      return rebalanced;
    });
  };

  const handleSplit = (axis = 'vertical', direction) => {
    setTerminals((prev) => {
      const sourceTerminal = prev.find((term) => term.id === focusedTerminalId);
      if (!canSplitTerminal(sourceTerminal, axis)) {
        return prev;
      }

      const originalBounds = { ...sourceTerminal.bounds };
      const splitAlongWidth = axis === 'vertical';
      const halfSpan = splitAlongWidth ? sourceTerminal.bounds.width / 2 : sourceTerminal.bounds.height / 2;
      const splitBefore = direction === 'left' || direction === 'up';
      const existingBounds = splitAlongWidth
        ? (splitBefore
            ? { ...sourceTerminal.bounds, x: sourceTerminal.bounds.x + halfSpan, width: halfSpan }
            : { ...sourceTerminal.bounds, width: halfSpan })
        : (splitBefore
            ? { ...sourceTerminal.bounds, y: sourceTerminal.bounds.y + halfSpan, height: halfSpan }
            : { ...sourceTerminal.bounds, height: halfSpan });
      const newBounds = splitAlongWidth
        ? (splitBefore
            ? { ...sourceTerminal.bounds, width: halfSpan }
            : { ...sourceTerminal.bounds, x: sourceTerminal.bounds.x + halfSpan, width: halfSpan })
        : (splitBefore
            ? { ...sourceTerminal.bounds, height: halfSpan }
            : { ...sourceTerminal.bounds, y: sourceTerminal.bounds.y + halfSpan, height: halfSpan });

      const nextTerminal = {
        id: `mux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        config: {
          ...sourceTerminal.config,
          name: getNextSplitName(sourceTerminal.config?.name, prev),
        },
        bounds: newBounds,
        mergePartnerId: sourceTerminal.id,
        mergeBounds: originalBounds,
      };

      setFocusedTerminalId(nextTerminal.id);

      return prev.flatMap((term) => {
        if (term.id === sourceTerminal.mergePartnerId) {
          return [clearMergeMetadata(term)];
        }

        if (term.id === focusedTerminalId) {
          return [{
            ...term,
            bounds: existingBounds,
            mergePartnerId: nextTerminal.id,
            mergeBounds: originalBounds,
          }, nextTerminal];
        }

        return [term];
      });
    });
  };

  const rects = computePanelRects(terminals, containerSize.w, containerSize.h);
  const focusedTerminal = terminals.find((term) => term.id === focusedTerminalId);
  const canSplitFocusedTerminalVertically = canSplitTerminal(focusedTerminal, 'vertical');
  const canSplitFocusedTerminalHorizontally = canSplitTerminal(focusedTerminal, 'horizontal');

  return (
    <div
      className={`mux-terminal-view ${active ? 'active' : 'hidden'}`}
      style={{ display: active ? 'flex' : 'none' }}
    >
      <div className="mux-toolbar">
        <span className="mux-template-name">{template?.name || 'No template selected'}</span>
        <div className="mux-toolbar-actions">
          <button
            className="mux-icon-btn"
            onClick={() => handleSplit('vertical', 'left')}
            disabled={!canSplitFocusedTerminalVertically}
            title="Split focused terminal to the left (Cmd/Ctrl+Shift+Left)"
            aria-label="Split focused terminal to the left"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12 5.75v12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M6.5 8.5h3v7h-3z" />
            </svg>
          </button>
          <button
            className="mux-icon-btn"
            onClick={() => handleSplit('vertical', 'right')}
            disabled={!canSplitFocusedTerminalVertically}
            title="Split focused terminal to the right (Cmd/Ctrl+Shift+Right)"
            aria-label="Split focused terminal to the right"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M12 5.75v12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M14.5 8.5h3v7h-3z" />
            </svg>
          </button>
          <button
            className="mux-icon-btn"
            onClick={() => handleSplit('horizontal', 'up')}
            disabled={!canSplitFocusedTerminalHorizontally}
            title="Split focused terminal upward (Cmd/Ctrl+Shift+Up)"
            aria-label="Split focused terminal upward"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M4.25 12h15.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M7.5 6.5h9v3h-9z" />
            </svg>
          </button>
          <button
            className="mux-icon-btn"
            onClick={() => handleSplit('horizontal', 'down')}
            disabled={!canSplitFocusedTerminalHorizontally}
            title="Split focused terminal downward (Cmd/Ctrl+Shift+Down)"
            aria-label="Split focused terminal downward"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
              <path d="M4.25 12h15.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M7.5 14.5h9v3h-9z" />
            </svg>
          </button>
          <button
            className="mux-icon-btn mux-edit-btn"
            onClick={onEditTemplate}
            title="Edit template"
            aria-label="Edit template"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4.2l9.9-9.9-4.2-4.2L4 15.8V20zm13-15.1 2.1 2.1c.5.5.5 1.3 0 1.8l-1.3 1.3-4.2-4.2 1.3-1.3c.5-.5 1.3-.5 1.8 0z" />
            </svg>
          </button>
        </div>
      </div>
      <div className="mux-grid-container" ref={containerRef}>
        {terminals.map(term => (
          <MuxTerminalPanel
            key={term.id}
            terminalId={term.id}
            config={term.config}
            rect={rects[term.id] || { left: 0, top: 0, width: 0, height: 0 }}
            onClose={() => handleCloseTerminal(term.id)}
            onFocus={() => handleFocusTerminal(term.id)}
            isFocused={term.id === focusedTerminalId}
          />
        ))}
      </div>
    </div>
  );
}

export default MuxTerminalView;
