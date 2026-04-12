import React, { useState, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import MuxTerminalPanel from './MuxTerminalPanel';
import './MuxTerminalView.css';
import {
  canSplitTerminal,
  closeTerminal,
  computePanelRects,
  createRuntimeTerminals,
  getNextSplitName,
  getTemplateSpawnSignature,
  serializeRuntimeLayout,
  clearMergeMetadata,
} from './muxLayout.mjs';

const MuxTerminalView = forwardRef(function MuxTerminalView({
  template,
  active = true,
  onEditTemplate,
  onPersistRuntimeLayout,
  onResetRuntimeLayout,
  transcriptEvent = null,
}, ref) {
  const [terminals, setTerminals] = useState([]);
  const [focusedTerminalId, setFocusedTerminalId] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const containerRef = useRef(null);
  const terminalRefs = useRef({});
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const pendingRuntimeLayoutRef = useRef(null);
  const spawnSignature = getTemplateSpawnSignature(template);

  const setTerminalRef = (terminalId, instance) => {
    if (instance) {
      terminalRefs.current[terminalId] = instance;
      return;
    }

    delete terminalRefs.current[terminalId];
  };

  useEffect(() => {
    if (!template) {
      setTerminals([]);
      setFocusedTerminalId(null);
      pendingRuntimeLayoutRef.current = null;
      return;
    }

    const newTerminals = createRuntimeTerminals(template);
    pendingRuntimeLayoutRef.current = null;
    setTerminals(newTerminals);
    setFocusedTerminalId(newTerminals[0]?.id || null);
  }, [spawnSignature, template, resetVersion]);

  useEffect(() => {
    if (!template?.id || !pendingRuntimeLayoutRef.current) return;

    onPersistRuntimeLayout?.(template.id, pendingRuntimeLayoutRef.current);
    pendingRuntimeLayoutRef.current = null;
  }, [onPersistRuntimeLayout, template, terminals]);

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

  useImperativeHandle(ref, () => ({
    sendTextToFocused: (text) => {
      const targetId = focusedTerminalId || terminals[0]?.id;
      if (!targetId) return;
      terminalRefs.current[targetId]?.writeText(text);
      terminalRefs.current[targetId]?.focus();
    },
  }), [focusedTerminalId, terminals]);

  useEffect(() => {
    if (!active || !transcriptEvent?.text) {
      return;
    }

    const targetId = focusedTerminalId || terminals[0]?.id;
    if (!targetId) {
      return;
    }

    terminalRefs.current[targetId]?.writeText(transcriptEvent.text);
    terminalRefs.current[targetId]?.focus();
  }, [active, focusedTerminalId, terminals, transcriptEvent]);

  const handleFocusTerminal = (terminalId) => {
    setFocusedTerminalId(terminalId);
  };

  const handleCloseTerminal = (terminalId) => {
    setTerminals((prev) => {
      const nextState = closeTerminal(prev, terminalId);
      if (nextState.terminals === prev) return prev;

      setFocusedTerminalId((currentFocusedId) => (
        currentFocusedId === terminalId ? nextState.focusedTerminalId : currentFocusedId
      ));
      pendingRuntimeLayoutRef.current = serializeRuntimeLayout(nextState.terminals);
      return nextState.terminals;
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

      const nextTerminals = prev.flatMap((term) => {
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
      pendingRuntimeLayoutRef.current = serializeRuntimeLayout(nextTerminals);
      return nextTerminals;
    });
  };

  const handleConfirmReset = () => {
    setShowResetConfirm(false);
    onResetRuntimeLayout?.(template.id);
    setResetVersion((prev) => prev + 1);
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
            className="mux-icon-btn"
            onClick={() => setShowResetConfirm(true)}
            disabled={!template}
            title="Reset layout and respawn terminals"
            aria-label="Reset layout and respawn terminals"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 8a7 7 0 1 0 2 4.95" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 3.75v4.5h-4.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
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
            ref={(instance) => setTerminalRef(term.id, instance)}
            terminalId={term.id}
            config={term.config}
            rect={rects[term.id] || { left: 0, top: 0, width: 0, height: 0 }}
            onClose={() => handleCloseTerminal(term.id)}
            onFocus={() => handleFocusTerminal(term.id)}
            isFocused={term.id === focusedTerminalId}
          />
        ))}
      </div>
      {showResetConfirm && (
        <div className="config-confirm-overlay">
          <div className="config-confirm-dialog">
            <h4>Reset this template?</h4>
            <p>Revert the current Mux layout to the saved template and respawn all terminals.</p>
            <div className="config-confirm-actions">
              <button className="btn-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="btn-confirm" onClick={handleConfirmReset}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default MuxTerminalView;
