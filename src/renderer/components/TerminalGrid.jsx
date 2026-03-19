import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import TerminalPanel from './TerminalPanel';
import './TerminalGrid.css';

const GAP = 6;

function buildOrder(agents, prevOrder) {
  const existingIds = new Set(agents.map((a) => a.id));
  const filtered = prevOrder
    .map((row) => row.filter((id) => existingIds.has(id)))
    .filter((row) => row.length > 0);
  const placedIds = new Set(filtered.flat());
  const newAgents = agents.filter((a) => !placedIds.has(a.id));
  if (newAgents.length === 0) return filtered;
  if (filtered.length === 0) return [newAgents.map((a) => a.id)];
  const result = filtered.map((r) => [...r]);
  result[result.length - 1] = [...result[result.length - 1], ...newAgents.map((a) => a.id)];
  return result;
}

// Compute absolute rects for each terminal given container size and layout
function computeRects(terminalOrder, containerW, containerH) {
  const rects = {};
  if (!containerW || !containerH || terminalOrder.length === 0) return rects;

  const numRows = terminalOrder.length;
  const totalRowH = containerH - GAP * (numRows + 1);
  const rowH = totalRowH / numRows;

  terminalOrder.forEach((row, rowIdx) => {
    const numCols = row.length;
    const totalColW = containerW - GAP * (numCols + 1);
    const colW = totalColW / numCols;
    const top = GAP + rowIdx * (rowH + GAP);

    row.forEach((agentId, colIdx) => {
      const left = GAP + colIdx * (colW + GAP);
      rects[agentId] = { top, left, width: colW, height: rowH };
    });
  });

  return rects;
}

// Compute rects for manual grid layout (1col/2col/3col)
function computeManualRects(agents, cols, containerW, containerH) {
  const rects = {};
  if (!containerW || !containerH || agents.length === 0) return rects;
  const numCols = Math.min(cols, agents.length);
  const numRows = Math.ceil(agents.length / numCols);
  const colW = (containerW - GAP * (numCols + 1)) / numCols;
  const rowH = (containerH - GAP * (numRows + 1)) / numRows;
  agents.forEach((agent, i) => {
    const col = i % numCols;
    const row = Math.floor(i / numCols);
    rects[agent.id] = {
      left: GAP + col * (colW + GAP),
      top:  GAP + row * (rowH + GAP),
      width: colW,
      height: rowH,
    };
  });
  return rects;
}

const TerminalGrid = forwardRef(function TerminalGrid({ agents, selectedAgent }, ref) {
  const [layout, setLayout] = useState('auto');
  const [terminalOrder, setTerminalOrder] = useState(() => [agents.map((a) => a.id)]);
  const termRefs = useRef({});
  const dragInfo = useRef(null);
  const containerRef = useRef(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });
  // Latch: once we have a real size, never go back to "no size"
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTerminalOrder((prev) => buildOrder(agents, prev));
  }, [agents]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setContainerSize({ w: width, h: height });
        setReady(true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setTermRef = useCallback((agentId, r) => {
    if (r) termRefs.current[agentId] = r;
    else delete termRefs.current[agentId];
  }, []);

  useImperativeHandle(ref, () => ({
    getTerminal: (agentId) => termRefs.current[agentId],
    getAllTerminals: () => termRefs.current,
    sendTextToFocused: (text) => {
      const targetId = selectedAgent || agents[0]?.id;
      if (targetId && termRefs.current[targetId]) termRefs.current[targetId].writeText(text);
    },
  }));

  const handleDragStart = useCallback((agentId, e) => {
    dragInfo.current = { agentId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', agentId);
    const ghost = document.createElement('div');
    ghost.textContent = agentId;
    ghost.style.cssText = 'position:fixed;top:-999px;padding:4px 10px;background:#0a0a0a;color:#00ff88;border:1px solid #00ff88;font:11px monospace;border-radius:4px;white-space:nowrap;pointer-events:none;';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  }, []);

  const handleDropInRow = useCallback((targetRowIdx, targetColIdx, e) => {
    e.preventDefault();
    e.stopPropagation();
    const { agentId } = dragInfo.current || {};
    if (!agentId) return;
    setTerminalOrder((prev) => {
      let rows = prev.map((row) => row.filter((id) => id !== agentId));
      rows[targetRowIdx] = [
        ...rows[targetRowIdx].slice(0, targetColIdx),
        agentId,
        ...rows[targetRowIdx].slice(targetColIdx),
      ];
      return rows.filter((r) => r.length > 0);
    });
    dragInfo.current = null;
  }, []);

  const handleDropBetweenRows = useCallback((insertBeforeRowIdx, e) => {
    e.preventDefault();
    e.stopPropagation();
    const { agentId } = dragInfo.current || {};
    if (!agentId) return;
    setTerminalOrder((prev) => {
      let rows = prev.map((row) => row.filter((id) => id !== agentId));
      rows = rows.filter((r) => r.length > 0);
      rows.splice(Math.min(insertBeforeRowIdx, rows.length), 0, [agentId]);
      return rows;
    });
    dragInfo.current = null;
  }, []);

  // Always compute rects — never split into two render trees
  const layoutCols = { '1col': 1, '2col': 2, '3col': 3 };
  const rects = layout === 'auto'
    ? computeRects(terminalOrder, containerSize.w, containerSize.h)
    : computeManualRects(agents, layoutCols[layout] ?? 2, containerSize.w, containerSize.h);

  const numRows = terminalOrder.length;

  // Row drop zones (auto mode only)
  const rowDropZones = [];
  if (layout === 'auto') {
    for (let i = 0; i <= numRows; i++) {
      const top = i === 0 ? 0 : GAP + (i - 1) * ((containerSize.h - GAP * (numRows + 1)) / numRows + GAP);
      rowDropZones.push({ insertBefore: i, top, height: GAP });
    }
  }

  return (
    <div className="terminal-grid-wrapper">
      <ToolbarRow layout={layout} setLayout={setLayout} count={agents.length} />
      <div className="terminal-grid-dnd-wrapper" ref={containerRef}>

        {/* Terminals — always mounted here, never in a separate tree */}
        {agents.map((agent) => {
          const rect = rects[agent.id];
          return (
            <div
              key={agent.id}
              className="terminal-portal"
              style={rect
                ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
                : { left: '-9999px', top: 0, width: 0, height: 0 }
              }
            >
              {/* Only mount TerminalPanel once we have real dimensions — never unmount after */}
              {ready && (
                <TerminalPanel
                  ref={(r) => setTermRef(agent.id, r)}
                  agent={agent}
                  isSelected={selectedAgent === agent.id}
                  onDragStart={layout === 'auto' ? (e) => handleDragStart(agent.id, e) : undefined}
                />
              )}
            </div>
          );
        })}

        {/* Drop zones — auto mode only */}
        {layout === 'auto' && terminalOrder.map((row, rowIdx) => {
          const numCols = row.length;
          const rowH = (containerSize.h - GAP * (numRows + 1)) / numRows;
          const colW = (containerSize.w - GAP * (numCols + 1)) / numCols;
          const rowTop = GAP + rowIdx * (rowH + GAP);
          return [
            ...row.map((_, colIdx) => (
              <ColDropZone
                key={`col-${rowIdx}-${colIdx}`}
                style={{ left: GAP + colIdx * (colW + GAP) - GAP, top: rowTop, width: GAP, height: rowH }}
                onDrop={(e) => handleDropInRow(rowIdx, colIdx, e)}
              />
            )),
            <ColDropZone
              key={`col-${rowIdx}-last`}
              style={{ left: GAP + numCols * (colW + GAP) - GAP, top: rowTop, width: GAP, height: rowH }}
              onDrop={(e) => handleDropInRow(rowIdx, numCols, e)}
            />,
          ];
        })}
        {layout === 'auto' && rowDropZones.map((zone) => (
          <RowDropZone
            key={`row-${zone.insertBefore}`}
            style={{ left: 0, top: zone.top, width: containerSize.w, height: zone.height }}
            onDrop={(e) => handleDropBetweenRows(zone.insertBefore, e)}
          />
        ))}
      </div>
    </div>
  );
});

function ToolbarRow({ layout, setLayout, count }) {
  return (
    <div className="terminal-grid-toolbar">
      <span className="terminal-grid-label">Terminals ({count})</span>
      <div className="layout-buttons">
        {['auto', '1col', '2col', '3col'].map((l) => (
          <button key={l} className={`layout-btn ${layout === l ? 'active' : ''}`} onClick={() => setLayout(l)}>
            {l === 'auto' ? 'Auto' : l}
          </button>
        ))}
      </div>
    </div>
  );
}

function RowDropZone({ style, onDrop }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`row-drop-zone ${active ? 'row-drop-zone--active' : ''}`}
      style={{ position: 'absolute', ...style }}
      onDragOver={(e) => { e.preventDefault(); setActive(true); }}
      onDragEnter={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => { setActive(false); onDrop(e); }}
    />
  );
}

function ColDropZone({ style, onDrop }) {
  const [active, setActive] = useState(false);
  return (
    <div
      className={`col-drop-zone ${active ? 'col-drop-zone--active' : ''}`}
      style={{ position: 'absolute', ...style }}
      onDragOver={(e) => { e.preventDefault(); setActive(true); }}
      onDragEnter={(e) => { e.preventDefault(); setActive(true); }}
      onDragLeave={() => setActive(false)}
      onDrop={(e) => { setActive(false); onDrop(e); }}
    />
  );
}

export default TerminalGrid;
