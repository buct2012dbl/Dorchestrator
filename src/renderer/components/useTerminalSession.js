import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

export const TERMINAL_THEME = {
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
};

const BASE_TERMINAL_OPTIONS = {
  theme: TERMINAL_THEME,
  fontSize: 12,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  cursorBlink: true,
  scrollback: 5000,
};

export default function useTerminalSession({
  sessionKey,
  canSpawn = true,
  spawnDelayMs = 0,
  restartOnExit = true,
  autoFocus = true,
  terminalOptions,
  onSpawn,
  onInput,
  onResize,
  onOpened,
  onFocus,
  onCleanup,
  beforeSpawn,
  shouldIgnoreInput,
}) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);
  const ptyAliveRef = useRef(false);
  const initializedRef = useRef(false);
  const handlersRef = useRef({});

  handlersRef.current = {
    beforeSpawn,
    onSpawn,
    onInput,
    onResize,
    onOpened,
    onFocus,
    onCleanup,
    shouldIgnoreInput,
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const terminal = new Terminal({
      ...BASE_TERMINAL_OPTIONS,
      ...terminalOptions,
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    termRef.current = terminal;
    fitAddonRef.current = fitAddon;
    ptyAliveRef.current = false;
    initializedRef.current = false;

    let spawnTimerId = null;
    let animationFrameId = null;
    let focusTarget = null;
    let focusHandler = null;

    const safeFit = () => {
      try {
        if (terminal.element && !terminal.isDisposed) {
          fitAddon.fit();
        }
      } catch (error) {
        console.warn('[useTerminalSession] Fit error:', error);
      }
    };

    const spawnSession = () => {
      if (!canSpawn) return;
      handlersRef.current.beforeSpawn?.({ terminal });
      ptyAliveRef.current = true;
      handlersRef.current.onSpawn?.({ terminal });
    };

    const openTerminal = () => {
      if (initializedRef.current) return;
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;

      initializedRef.current = true;
      terminal.open(el);
      handlersRef.current.onOpened?.({ terminal, fitAddon });

      if (handlersRef.current.onFocus && terminal.textarea) {
        focusTarget = terminal.textarea;
        focusHandler = () => handlersRef.current.onFocus?.();
        focusTarget.addEventListener('focus', focusHandler);
      }

      safeFit();

      if (canSpawn) {
        spawnTimerId = window.setTimeout(() => {
          spawnSession();
        }, spawnDelayMs);
      }

      if (autoFocus) {
        terminal.focus();
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (!initializedRef.current) {
        openTerminal();
        return;
      }

      safeFit();
      if (ptyAliveRef.current && terminal.cols && terminal.rows) {
        handlersRef.current.onResize?.({ terminal });
      }
    });

    resizeObserver.observe(el);

    const inputDisposable = terminal.onData((data) => {
      if (!ptyAliveRef.current) {
        if (!restartOnExit || !canSpawn) {
          return;
        }
        terminal.clear();
        spawnSession();
        return;
      }

      if (handlersRef.current.shouldIgnoreInput?.(data)) {
        return;
      }

      handlersRef.current.onInput?.({ terminal, data });
    });

    animationFrameId = window.requestAnimationFrame(openTerminal);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      if (spawnTimerId !== null) {
        window.clearTimeout(spawnTimerId);
      }
      resizeObserver.disconnect();
      inputDisposable.dispose();
      if (focusTarget && focusHandler) {
        focusTarget.removeEventListener('focus', focusHandler);
      }
      if (!terminal.isDisposed) {
        terminal.dispose();
      }
      termRef.current = null;
      fitAddonRef.current = null;
      ptyAliveRef.current = false;
      initializedRef.current = false;
      handlersRef.current.onCleanup?.();
    };
  }, [
    autoFocus,
    canSpawn,
    restartOnExit,
    sessionKey,
    spawnDelayMs,
    terminalOptions,
  ]);

  return {
    containerRef,
    termRef,
    fitAddonRef,
    ptyAliveRef,
  };
}
