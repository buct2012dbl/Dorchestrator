import React, { useEffect, forwardRef, useImperativeHandle } from 'react';
import '@xterm/xterm/css/xterm.css';
import './MuxTerminalPanel.css';
import useTerminalSession from '../useTerminalSession';

const MuxTerminalPanel = forwardRef(function MuxTerminalPanel({ terminalId, config, rect, onClose, onFocus, isFocused = false }, ref) {
  const canSpawn = config.cliType !== 'empty';
  const sessionKey = `${terminalId}:${JSON.stringify(config)}`;
  const { containerRef, termRef, fitAddonRef, ptyAliveRef } = useTerminalSession({
    sessionKey,
    canSpawn,
    onSpawn: ({ terminal }) => {
      window.electronAPI?.spawnMuxTerminal({
        terminalId,
        config,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    },
    onInput: ({ data }) => {
      window.electronAPI?.muxPtyInput({ terminalId, data });
    },
    onResize: ({ terminal }) => {
      window.electronAPI?.muxPtyResize({
        terminalId,
        cols: terminal.cols,
        rows: terminal.rows,
      });
    },
    onFocus: () => {
      onFocus?.();
    },
    onCleanup: () => {
      window.electronAPI?.killMuxTerminal({ terminalId });
    },
  });

  useImperativeHandle(ref, () => ({
    resize: () => fitAddonRef.current?.fit(),
    focus: () => termRef.current?.focus(),
    writeText: (text) => {
      if (!termRef.current) {
        return;
      }

      termRef.current.focus();

      if (ptyAliveRef.current) {
        // Route through xterm's paste path so mux sessions receive the same
        // bracketed-paste/user-input behavior as manual text entry.
        termRef.current.paste(text);
      }
    },
  }));

  useEffect(() => {
    if (isFocused) {
      termRef.current?.focus();
    }
  }, [isFocused]);

  useEffect(() => {
    const unsubData = window.electronAPI?.onMuxPtyData(({ terminalId: id, data }) => {
      if (id === terminalId) {
        termRef.current?.write(data);
      }
    });

    const unsubExit = window.electronAPI?.onMuxPtyExit(({ terminalId: id }) => {
      if (id === terminalId) {
        ptyAliveRef.current = false;
        termRef.current?.writeln('\r\n\x1b[33m[Session ended - press any key to restart]\x1b[0m');
      }
    });

    return () => {
      unsubData?.();
      unsubExit?.();
    };
  }, [ptyAliveRef, termRef, terminalId]);

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
