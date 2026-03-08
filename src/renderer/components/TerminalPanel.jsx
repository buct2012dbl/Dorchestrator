import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './TerminalPanel.css';

const TerminalPanel = forwardRef(function TerminalPanel({ agent, isSelected }, ref) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const initialized = useRef(false);
  const ptyAlive = useRef(false);

  useImperativeHandle(ref, () => ({
    write: (text) => termRef.current?.write(text),
    writeln: (text) => termRef.current?.writeln(text),
    clear: () => termRef.current?.clear(),
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
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;
    initialized.current = false;
    ptyAlive.current = false;

    function spawnSession() {
      ptyAlive.current = true;
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
          try { fitAddon.fit(); } catch {}
          spawnSession();
        }, 50);

        // Forward all raw input directly to the PTY
        terminal.onData((data) => {
          if (!ptyAlive.current) {
            // Restart on any keypress after session ends
            spawnSession();
            return;
          }
          window.electronAPI?.ptyInput({ agentId: agent.id, data });
        });

        terminal.focus();
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      if (!initialized.current) {
        tryOpen();
        return;
      }
      try { fitAddon.fit(); } catch {}
      if (ptyAlive.current) {
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
      terminal.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      initialized.current = false;
      ptyAlive.current = false;
      window.electronAPI?.killAgent({ agentId: agent.id });
    };
  }, [agent.id, agent.data]);

  return (
    <div className={`terminal-panel ${isSelected ? 'terminal-selected' : ''}`}>
      <div className="terminal-panel-header" style={{ borderTop: `2px solid ${agent.data.color}` }}>
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

function getColorCode(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (r > g && r > b) return '31';
  if (g > r && g > b) return '32';
  if (b > r && b > g) return '34';
  if (r > 150 && g > 100) return '33';
  return '37';
}

function getStatusColor(status) {
  const map = { idle: '#6b6b6b', running: '#2472c8', success: '#0dbc79', error: '#cd3131', waiting: '#e5e510' };
  return map[status] || '#6b6b6b';
}

export default TerminalPanel;
