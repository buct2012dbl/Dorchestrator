import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import './MuxTerminalPanel.css';

const MuxTerminalPanel = forwardRef(function MuxTerminalPanel({ terminalId, config, rect, onClose, onFocus, isFocused = false }, ref) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const ptyAliveRef = useRef(false);

  useImperativeHandle(ref, () => ({
    resize: () => fitAddonRef.current?.fit(),
    focus: () => termRef.current?.focus(),
  }));

  useEffect(() => {
    if (!containerRef.current) return;

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
    ptyAliveRef.current = false;

    let spawned = false;

    function spawnSession() {
      if (config.cliType === 'empty') return;

      ptyAliveRef.current = true;
      window.electronAPI?.spawnMuxTerminal({
        terminalId,
        config,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    }

    // Wait for container to have real dimensions before opening terminal
    const resizeObserver = new ResizeObserver(() => {
      const el = containerRef.current;
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return;

      if (!spawned) {
        spawned = true;
        terminal.open(el);
        fitAddon.fit();

        // Spawn PTY if not empty
        if (config.cliType !== 'empty') {
          spawnSession();
        }
      } else {
        fitAddon.fit();
        if (ptyAliveRef.current) {
          window.electronAPI?.muxPtyResize({
            terminalId,
            cols: terminal.cols,
            rows: terminal.rows,
          });
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // Listen for PTY data
    const unsubData = window.electronAPI?.onMuxPtyData(({ terminalId: id, data }) => {
      if (id === terminalId) {
        terminal.write(data);
      }
    });

    const unsubExit = window.electronAPI?.onMuxPtyExit(({ terminalId: id }) => {
      if (id === terminalId) {
        ptyAliveRef.current = false;
        terminal.writeln('\r\n\x1b[33m[Session ended - press any key to restart]\x1b[0m');
      }
    });

    // Handle user input
    terminal.onData((data) => {
      if (!ptyAliveRef.current) {
        if (config.cliType === 'empty') {
          return;
        }
        terminal.clear();
        spawnSession();
        return;
      }
      window.electronAPI?.muxPtyInput({ terminalId, data });
    });

    return () => {
      resizeObserver.disconnect();
      unsubData?.();
      unsubExit?.();
      terminal.dispose();
      ptyAliveRef.current = false;
      window.electronAPI?.killMuxTerminal({ terminalId });
    };
  }, [terminalId, config]);

  useEffect(() => {
    if (isFocused) {
      termRef.current?.focus();
    }
  }, [isFocused]);

  return (
    <div
      className={`mux-terminal-panel ${isFocused ? 'focused' : ''}`}
      style={{
        position: 'absolute',
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
      onMouseDown={() => onFocus?.()}
    >
      <div className="mux-terminal-header">
        <span className="mux-terminal-name">{config.name}</span>
        <button className="mux-terminal-close" onClick={onClose}>×</button>
      </div>
      <div className="mux-terminal-content" ref={containerRef} />
    </div>
  );
});

export default MuxTerminalPanel;
