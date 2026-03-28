import React, { useEffect, useState } from 'react';
import {
  getDefaultModelForTerminalType,
  getModelsForTerminalType,
} from '../../constants/models';
import './TemplateEditorModal.css';

const generateTerminals = (r, c) => {
  const terms = [];
  for (let row = 0; row < r; row++) {
    for (let col = 0; col < c; col++) {
      terms.push({
        id: `t${row}-${col}`,
        row,
        col,
        config: {
          cliType: 'empty',
          name: `Terminal ${row + 1}-${col + 1}`,
          model: 'claude-sonnet-4-6',
          systemPrompt: '',
        },
      });
    }
  }
  return terms;
};

const normalizeTerminalConfig = (terminal) => {
  const cliType = terminal.config.cliType || 'empty';
  const normalized = {
    ...terminal,
    config: {
      ...terminal.config,
      cliType,
    },
  };

  if (cliType === 'empty' || cliType === 'shell') {
    normalized.config.model = '';
    return normalized;
  }

  const validModels = getModelsForTerminalType(cliType);
  if (!validModels.includes(normalized.config.model)) {
    normalized.config.model = getDefaultModelForTerminalType(cliType);
  }

  return normalized;
};

function TemplateEditorModal({ template, onSave, onCancel }) {
  const [name, setName] = useState(template?.name || '');
  const [rows, setRows] = useState(template?.layout.rows || 2);
  const [cols, setCols] = useState(template?.layout.cols || 2);
  const [rowInput, setRowInput] = useState(String(template?.layout.rows || 2));
  const [colInput, setColInput] = useState(String(template?.layout.cols || 2));
  const [terminals, setTerminals] = useState(() => {
    if (template?.layout.terminals) return template.layout.terminals.map(normalizeTerminalConfig);
    return generateTerminals(2, 2);
  });
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    setRowInput(String(rows));
  }, [rows]);

  useEffect(() => {
    setColInput(String(cols));
  }, [cols]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Please enter a template name');
      return;
    }

    const newTemplate = {
      id: template?.id || `template-${Date.now()}`,
      name: name.trim(),
      layout: { rows, cols, terminals: terminals.map(normalizeTerminalConfig) },
    };

    onSave(newTemplate);
  };

  const handleGridSizeChange = (newRows, newCols) => {
    setRows(newRows);
    setCols(newCols);
    setTerminals(generateTerminals(newRows, newCols));
    setSelectedCell(null);
  };

  const commitDimensionChange = (dimension, rawValue) => {
    const nextValue = Number.parseInt(rawValue, 10);
    if (Number.isNaN(nextValue)) {
      if (dimension === 'rows') setRowInput(String(rows));
      else setColInput(String(cols));
      return;
    }

    const clampedValue = Math.max(1, Math.min(4, nextValue));
    if (dimension === 'rows') setRowInput(String(clampedValue));
    else setColInput(String(clampedValue));

    if (dimension === 'rows') {
      handleGridSizeChange(clampedValue, cols);
      return;
    }

    handleGridSizeChange(rows, clampedValue);
  };

  const handleDimensionInputChange = (dimension, rawValue) => {
    if (!/^\d*$/.test(rawValue)) return;

    if (dimension === 'rows') {
      setRowInput(rawValue);
    } else {
      setColInput(rawValue);
    }

    if (!rawValue) return;
    commitDimensionChange(dimension, rawValue);
  };

  const handleDimensionKeyDown = (event, dimension, rawValue) => {
    if (event.key === 'Enter') {
      commitDimensionChange(dimension, rawValue);
      event.currentTarget.blur();
    }
  };

  const updateTerminalConfig = (row, col, field, value) => {
    setTerminals(prev =>
      prev.map(t =>
        t.row === row && t.col === col
          ? { ...t, config: { ...t.config, [field]: value } }
          : t
      )
    );
  };

  const handleCliTypeChange = (terminal, cliType) => {
    const nextConfig = { cliType };

    if (cliType === 'empty' || cliType === 'shell') {
      nextConfig.model = '';
    } else {
      nextConfig.model = getDefaultModelForTerminalType(cliType);
    }

    setTerminals(prev =>
      prev.map(t =>
        t.row === terminal.row && t.col === terminal.col
          ? { ...t, config: { ...t.config, ...nextConfig } }
          : t
      )
    );
  };

  const selectedTerminal = selectedCell !== null
    ? terminals.find(t => t.row === Math.floor(selectedCell / cols) && t.col === selectedCell % cols)
    : null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="template-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{template ? 'Edit Template' : 'New Template'}</h2>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Template"
              autoFocus
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Rows(1-4)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-4]*"
                value={rowInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleDimensionInputChange('rows', e.target.value)}
                onBlur={(e) => commitDimensionChange('rows', e.target.value)}
                onKeyDown={(e) => handleDimensionKeyDown(e, 'rows', rowInput)}
              />
            </div>
            <div className="form-group">
              <label>Columns(1-4)</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-4]*"
                value={colInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleDimensionInputChange('cols', e.target.value)}
                onBlur={(e) => commitDimensionChange('cols', e.target.value)}
                onKeyDown={(e) => handleDimensionKeyDown(e, 'cols', colInput)}
              />
            </div>
          </div>

          <div className="editor-layout">
            <div className="grid-preview">
              <div className="grid-preview-label">Grid Layout ({rows}×{cols})</div>
              <div
                className="grid-preview-container"
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(${rows}, 1fr)`,
                  gridTemplateColumns: `repeat(${cols}, 1fr)`,
                  gap: '4px',
                }}
              >
                {Array.from({ length: rows * cols }).map((_, i) => {
                  const row = Math.floor(i / cols);
                  const col = i % cols;
                  const term = terminals.find(t => t.row === row && t.col === col);
                  return (
                    <div
                      key={i}
                      className={`grid-preview-cell ${selectedCell === i ? 'selected' : ''}`}
                      onClick={() => setSelectedCell(i)}
                    >
                      <div className="cell-number">{i + 1}</div>
                      <div className="cell-type">{term?.config.cliType || 'empty'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {selectedTerminal && (
              <div className="terminal-config">
                <div className="config-header">Terminal {selectedCell + 1} Config</div>

                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={selectedTerminal.config.name}
                    onChange={(e) => updateTerminalConfig(selectedTerminal.row, selectedTerminal.col, 'name', e.target.value)}
                    placeholder="Terminal name"
                  />
                </div>

                <div className="form-group">
                  <label>CLI Type</label>
                  <select
                    value={selectedTerminal.config.cliType}
                    onChange={(e) => handleCliTypeChange(selectedTerminal, e.target.value)}
                  >
                    <option value="empty">Empty (no CLI)</option>
                    <option value="shell">Shell</option>
                    <option value="claude-code">Claude Code</option>
                    <option value="codex">Codex</option>
                    <option value="coding-agent">Coding Agent (built-in)</option>
                  </select>
                </div>

                {selectedTerminal.config.cliType !== 'empty' && selectedTerminal.config.cliType !== 'shell' && (
                  <>
                    <div className="form-group">
                      <label>Model</label>
                      <select
                        value={selectedTerminal.config.model}
                        onChange={(e) => updateTerminalConfig(selectedTerminal.row, selectedTerminal.col, 'model', e.target.value)}
                      >
                        {getModelsForTerminalType(selectedTerminal.config.cliType).map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>System Prompt (optional)</label>
                      <textarea
                        value={selectedTerminal.config.systemPrompt}
                        onChange={(e) => updateTerminalConfig(selectedTerminal.row, selectedTerminal.col, 'systemPrompt', e.target.value)}
                        placeholder="Custom system prompt..."
                        rows="4"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Template</button>
        </div>
      </div>
    </div>
  );
}

export default TemplateEditorModal;
