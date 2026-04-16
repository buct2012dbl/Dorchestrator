import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { TERMINAL_THEME } from '../useTerminalSession';
import './KanbanTranscriptTerminal.css';

function KanbanTranscriptTerminal({ sessionKey, transcript }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const lastTranscriptRef = useRef('');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const terminal = new Terminal({
      theme: TERMINAL_THEME,
      fontSize: 12,
      fontFamily: 'Share Tech Mono, Menlo, Monaco, monospace',
      cursorBlink: false,
      disableStdin: true,
      scrollback: 12000,
      convertEol: false,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();
    terminal.write(transcript || '');
    terminal.scrollToBottom();

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;
    lastTranscriptRef.current = transcript || '';

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {}
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      lastTranscriptRef.current = '';
    };
  }, [sessionKey]);

  useEffect(() => {
    const terminal = termRef.current;
    if (!terminal) return;

    const prev = lastTranscriptRef.current;
    const next = transcript || '';

    if (!next.startsWith(prev)) {
      terminal.reset();
      terminal.write(next);
      terminal.scrollToBottom();
      lastTranscriptRef.current = next;
      return;
    }

    const delta = next.slice(prev.length);
    if (delta) {
      terminal.write(delta);
      terminal.scrollToBottom();
      lastTranscriptRef.current = next;
    }
  }, [transcript]);

  return <div ref={containerRef} className="kanban-transcript-terminal" />;
}

export default KanbanTranscriptTerminal;
