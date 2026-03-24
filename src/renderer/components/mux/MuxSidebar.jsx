import React from 'react';
import './MuxSidebar.css';

function MuxSidebar({ templates, selectedTemplate, onSelectTemplate, onNewTemplate, onDeleteTemplate }) {
  return (
    <div className="mux-sidebar">
      <div className="mux-sidebar-header">
        <span className="mux-sidebar-title">TEMPLATES</span>
        <button className="mux-new-template-btn" onClick={onNewTemplate}>+</button>
      </div>
      <div className="mux-sidebar-list">
        {templates.map((template, idx) => (
          <div
            key={template.id}
            className={`mux-sidebar-item ${selectedTemplate === template.id ? 'active' : ''}`}
            onClick={() => onSelectTemplate(template.id)}
          >
            <div className="mux-sidebar-item-header">
              <span className="mux-sidebar-item-number">{idx + 1}</span>
              <span className="mux-sidebar-item-name">{template.name}</span>
            </div>
            <div className="mux-sidebar-item-meta">
              <span className="mux-sidebar-layout">{template.layout.rows}×{template.layout.cols}</span>
              <span className="mux-sidebar-terminal-count">{template.layout.terminals.length} terminals</span>
            </div>
            <button
              className="mux-sidebar-delete"
              onClick={(e) => { e.stopPropagation(); onDeleteTemplate(template.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MuxSidebar;
