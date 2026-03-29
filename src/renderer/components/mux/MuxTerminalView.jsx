import React, { useState, useEffect, useRef } from 'react';
import MuxTerminalPanel from './MuxTerminalPanel';
import './MuxTerminalView.css';

const GAP = 6;

function computeGridRects(layout, containerW, containerH) {
  const rects = {};
  if (!containerW || !containerH || !layout) return rects;

  const { rows, cols, terminals } = layout;
  const colW = (containerW - GAP * (cols + 1)) / cols;
  const rowH = (containerH - GAP * (rows + 1)) / rows;

  terminals.forEach(term => {
    const { row, col } = term;
    rects[term.id] = {
      left: GAP + col * (colW + GAP),
      top: GAP + row * (rowH + GAP),
      width: colW,
      height: rowH,
    };
  });

  return rects;
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

function MuxTerminalView({ template, active = true, onEditTemplate }) {
  const [terminals, setTerminals] = useState([]);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  const termRefs = useRef({});
  const spawnSignature = getTemplateSpawnSignature(template);

  useEffect(() => {
    if (!template) {
      setTerminals([]);
      return;
    }

    const newTerminals = template.layout.terminals.map(termConfig => ({
      id: `mux-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      config: termConfig.config,
      position: termConfig,
    }));

    setTerminals(newTerminals);
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

  const handleCloseTerminal = (terminalId) => {
    setTerminals(prev => prev.filter(t => t.id !== terminalId));
  };

  const rects = computeGridRects(template?.layout, containerSize.w, containerSize.h);

  return (
    <div
      className={`mux-terminal-view ${active ? 'active' : 'hidden'}`}
      style={{ display: active ? 'flex' : 'none' }}
    >
      <div className="mux-toolbar">
        <span className="mux-template-name">{template?.name || 'No template selected'}</span>
        <button className="mux-save-btn" onClick={onEditTemplate}>Edit</button>
      </div>
      <div className="mux-grid-container" ref={containerRef}>
        {terminals.map(term => (
          <MuxTerminalPanel
            key={term.id}
            terminalId={term.id}
            config={term.config}
            rect={rects[term.position.id] || { left: 0, top: 0, width: 0, height: 0 }}
            onClose={() => handleCloseTerminal(term.id)}
            ref={el => termRefs.current[term.id] = el}
          />
        ))}
      </div>
    </div>
  );
}

export default MuxTerminalView;
