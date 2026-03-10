import React, { useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import TerminalPanel from './TerminalPanel';
import './TerminalGrid.css';

const TerminalGrid = forwardRef(function TerminalGrid({ agents, selectedAgent }, ref) {
  const [layout, setLayout] = useState('auto');
  const termRefs = useRef({});

  const setTermRef = useCallback((agentId, terminalRef) => {
    if (terminalRef) {
      termRefs.current[agentId] = terminalRef;
    } else {
      delete termRefs.current[agentId];
    }
  }, []);

  useImperativeHandle(ref, () => ({
    getTerminal: (agentId) => termRefs.current[agentId],
    getAllTerminals: () => termRefs.current,
    sendTextToFocused: (text) => {
      // Send to selected terminal or first available
      const targetId = selectedAgent || agents[0]?.id;
      if (targetId && termRefs.current[targetId]) {
        termRefs.current[targetId].writeText(text);
      }
    },
  }));

  const getGridClass = () => {
    if (layout === 'auto') {
      const count = agents.length;
      if (count <= 1) return 'grid-1';
      if (count <= 2) return 'grid-2';
      if (count <= 4) return 'grid-2x2';
      if (count <= 6) return 'grid-3x2';
      return 'grid-3x3';
    }
    return `grid-${layout}`;
  };

  return (
    <div className="terminal-grid-wrapper">
      <div className="terminal-grid-toolbar">
        <span className="terminal-grid-label">Terminals ({agents.length})</span>
        <div className="layout-buttons">
          {['auto', '1col', '2col', '3col'].map((l) => (
            <button
              key={l}
              className={`layout-btn ${layout === l ? 'active' : ''}`}
              onClick={() => setLayout(l)}
            >
              {l === 'auto' ? 'Auto' : l}
            </button>
          ))}
        </div>
      </div>
      <div className={`terminal-grid ${getGridClass()}`}>
        {agents.map((agent) => (
          <TerminalPanel
            key={agent.id}
            ref={(r) => setTermRef(agent.id, r)}
            agent={agent}
            isSelected={selectedAgent === agent.id}
          />
        ))}
      </div>
    </div>
  );
});

export default TerminalGrid;
