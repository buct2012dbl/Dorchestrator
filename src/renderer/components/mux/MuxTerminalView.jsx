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

function rebalanceTerminals(terminals) {
  if (terminals.length === 0) return [];

  const width = 1 / terminals.length;
  return terminals.map((term, index) => ({
    ...clearMergeMetadata(term),
    bounds: {
      x: index * width,
      y: 0,
      width,
      height: 1,
    },
  }));
}

function MuxTerminalView({ template, active = true, onEditTemplate }) {
  const [terminals, setTerminals] = useState([]);
  const [focusedTerminalId, setFocusedTerminalId] = useState(null);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const termRefs = useRef({});
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
        handleVerticalSplit('left');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleVerticalSplit('right');
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

  const handleVerticalSplit = (direction = 'right') => {
    setTerminals((prev) => {
      const sourceTerminal = prev.find((term) => term.id === focusedTerminalId);
      if (!sourceTerminal || sourceTerminal.bounds.width < MIN_SPLIT_FRACTION * 2) {
        return prev;
      }

      const halfWidth = sourceTerminal.bounds.width / 2;
      const splitOnLeft = direction === 'left';
      const existingBounds = splitOnLeft
        ? { ...sourceTerminal.bounds, x: sourceTerminal.bounds.x + halfWidth, width: halfWidth }
        : { ...sourceTerminal.bounds, width: halfWidth };
      const newBounds = splitOnLeft
        ? { ...sourceTerminal.bounds, width: halfWidth }
        : { ...sourceTerminal.bounds, x: sourceTerminal.bounds.x + halfWidth, width: halfWidth };

      const nextTerminal = {
        id: `mux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        config: {
          ...sourceTerminal.config,
          name: getNextSplitName(sourceTerminal.config?.name, prev),
        },
        bounds: newBounds,
        mergePartnerId: sourceTerminal.id,
        mergeBounds: { ...sourceTerminal.bounds },
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
            mergeBounds: { ...sourceTerminal.bounds },
          }, nextTerminal];
        }

        return [term];
      });
    });
  };

  const rects = computePanelRects(terminals, containerSize.w, containerSize.h);
  const canSplitFocusedTerminal = terminals.some(
    (term) => term.id === focusedTerminalId && term.bounds.width >= MIN_SPLIT_FRACTION * 2
  );

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
            onClick={() => handleVerticalSplit('right')}
            disabled={!canSplitFocusedTerminal}
            title="Split focused terminal vertically (Cmd/Ctrl+Shift+Right)"
            aria-label="Split focused terminal vertically"
          >
            | |
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
            ref={el => termRefs.current[term.id] = el}
          />
        ))}
      </div>
    </div>
  );
}

export default MuxTerminalView;
