import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import './TerminalPanel.css';
import useTerminalSession from '../useTerminalSession';

const TERMINAL_OPTIONS = { allowProposedApi: true };

const TerminalPanel = forwardRef(function TerminalPanel({ agent, isSelected, onDragStart, onSelect }, ref) {
  const justSpawned = useRef(false);
  const spawnFilterTimerRef = useRef(null);

  const { containerRef, termRef, ptyAliveRef } = useTerminalSession({
    sessionKey: `${agent.id}:${agent.data.restartKey || ''}`,
    terminalOptions: TERMINAL_OPTIONS,
    spawnDelayMs: 100,
    beforeSpawn: () => {
      justSpawned.current = true;
      if (spawnFilterTimerRef.current !== null) {
        window.clearTimeout(spawnFilterTimerRef.current);
      }
      spawnFilterTimerRef.current = window.setTimeout(() => {
        justSpawned.current = false;
        spawnFilterTimerRef.current = null;
      }, 500);
    },
    onSpawn: ({ terminal }) => {
      console.log('[Renderer] Spawning agent:', agent.id, 'with data:', agent.data);
      window.electronAPI?.spawnAgent({
        agentId: agent.id,
        agentData: agent.data,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    },
    onInput: ({ data }) => {
      window.electronAPI?.ptyInput({ agentId: agent.id, data });
    },
    onResize: ({ terminal }) => {
      window.electronAPI?.ptyResize({
        agentId: agent.id,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    },
    onFocus: () => {
      onSelect?.();
    },
    onCleanup: () => {
      if (spawnFilterTimerRef.current !== null) {
        window.clearTimeout(spawnFilterTimerRef.current);
        spawnFilterTimerRef.current = null;
      }
      justSpawned.current = false;
      window.electronAPI?.killAgent({ agentId: agent.id });
    },
    shouldIgnoreInput: (data) => data.match(/^\x1b\[\?1;/),
  });

  useImperativeHandle(ref, () => ({
    write: (text) => {
      // Filter initialization sequences only in the first 500ms after spawn
      if (justSpawned.current) {
        const filtered = text
          .replace(/\x1b\[\?1;\d+c/g, '')  // Device attributes response
          .replace(/\x1b\[\?1049[hl]/g, '') // Alternate screen buffer
          .replace(/\x1b\[>\d+;\d+;\d+c/g, '') // Secondary device attributes
          .replace(/\x1b\]0;.*?\x07/g, ''); // Window title sequences

        if (filtered) {
          termRef.current?.write(filtered, () => termRef.current?.scrollToBottom());
        }
      } else {
        termRef.current?.write(text, () => termRef.current?.scrollToBottom());
      }
    },
    writeln: (text) => {
      termRef.current?.writeln(text, () => termRef.current?.scrollToBottom());
    },
    clear: () => termRef.current?.clear(),
    writeText: (text) => {
      // Write text as if user typed it
      if (termRef.current && ptyAliveRef.current) {
        window.electronAPI?.ptyInput({ agentId: agent.id, data: text });
      }
    },
    notifyExit: () => {
      ptyAliveRef.current = false;
      termRef.current?.writeln('\r\n\x1b[33m[Session ended — press any key to restart]\x1b[0m');
    },
  }));

  return (
    <div className={`terminal-panel ${isSelected ? 'terminal-selected' : ''}`} onClick={onSelect}>
      <div className="terminal-panel-header" draggable={!!onDragStart} onDragStart={onDragStart} style={{ borderTop: `2px solid ${agent.data.color}`, cursor: onDragStart ? 'grab' : 'default' }}>
        <span className="terminal-panel-dot" style={{ background: agent.data.color }} />
        <span className="terminal-panel-title">{agent.data.name}</span>
        <span className="terminal-panel-role">{agent.data.role}</span>
        <span
          className="terminal-panel-status"
          style={{ color: getStatusColor(agent.data.status) }}
        >
          {agent.data.status}
        </span>
      </div>
      <div ref={containerRef} className="terminal-panel-content" />
    </div>
  );
});

function getStatusColor(status) {
  const map = { idle: '#6b6b6b', running: '#2472c8', success: '#0dbc79', error: '#cd3131', waiting: '#e5e510' };
  return map[status] || '#6b6b6b';
}

export default TerminalPanel;
