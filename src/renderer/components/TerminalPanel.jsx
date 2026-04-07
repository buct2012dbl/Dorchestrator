import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './TerminalPanel.css';

const TerminalPanel = forwardRef(function TerminalPanel({ agent, isSelected, onDragStart, onSelect }, ref) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const initialized = useRef(false);
  const ptyAlive = useRef(false);
  const justSpawned = useRef(false);

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
      if (termRef.current && ptyAlive.current) {
        window.electronAPI?.ptyInput({ agentId: agent.id, data: text });
      }
    },
    notifyExit: () => {
      ptyAlive.current = false;
      termRef.current?.writeln('\r\n\x1b[33m[Session ended — press any key to restart]\x1b[0m');
    },
  }));

  useEffect(() => {
    console.log('[TerminalPanel] Mounting for agent:', agent.id, agent.data);
    const el = containerRef.current;
    if (!el) return;

    const terminal = new Terminal({
      theme: {
        background: '#1a1a1a',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        cursorAccent: '#1a1a1a',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
      },
      fontSize: 12,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;
    initialized.current = false;
    ptyAlive.current = false;

    function spawnSession() {
      ptyAlive.current = true;
      justSpawned.current = true;

      // Disable filtering after 500ms
      setTimeout(() => {
        justSpawned.current = false;
      }, 500);

      console.log('[Renderer] Spawning agent:', agent.id, 'with data:', agent.data);
      window.electronAPI?.spawnAgent({
        agentId: agent.id,
        agentData: agent.data,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    }

    function tryOpen() {
      if (initialized.current) return;
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) {
        initialized.current = true;
        terminal.open(el);

        setTimeout(() => {
          try {
            if (fitAddon && terminal && terminal.element) {
              fitAddon.fit();
            }
          } catch {}
          spawnSession();
        }, 100);

        // Forward all raw input directly to the PTY
        terminal.onData((data) => {
          if (!ptyAlive.current) {
            // Restart on any keypress after session ends (consume the keypress)
            terminal.clear();
            spawnSession();
            return;
          }
          // Filter out device attribute responses that xterm sends automatically
          if (data.match(/^\x1b\[\?1;/)) {
            return; // Don't send these to PTY
          }
          window.electronAPI?.ptyInput({ agentId: agent.id, data });
        });

        // Update selection when terminal is focused
        terminal.textarea?.addEventListener('focus', () => {
          onSelect?.();
        });

        terminal.focus();
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!initialized.current) {
        tryOpen();
        return;
      }
      try {
        // Only fit if terminal is properly initialized and has element
        if (terminal && fitAddon && terminal.element && !terminal.isDisposed) {
          fitAddon.fit();
        }
      } catch (e) {
        console.warn('[TerminalPanel] Fit error:', e);
      }
      if (ptyAlive.current && terminal && terminal.cols && terminal.rows) {
        window.electronAPI?.ptyResize({
          agentId: agent.id,
          cols: terminal.cols,
          rows: terminal.rows,
        });
      }
    });
    resizeObserver.observe(el);

    requestAnimationFrame(tryOpen);

    return () => {
      resizeObserver.disconnect();
      // Dispose terminal safely
      if (terminal && !terminal.isDisposed) {
        terminal.dispose();
      }
      termRef.current = null;
      fitAddonRef.current = null;
      initialized.current = false;
      ptyAlive.current = false;
      window.electronAPI?.killAgent({ agentId: agent.id });
    };
  }, [agent.id, agent.data.restartKey]); // Restart when restartKey changes

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
