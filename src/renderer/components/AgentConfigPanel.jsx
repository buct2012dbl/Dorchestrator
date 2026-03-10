import React, { useState, useEffect } from 'react';
import { AGENT_TEMPLATES } from '../store/agentStore';
import './AgentConfigPanel.css';

function AgentConfigPanel({ agent, onUpdate, onClose, onRemove }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (agent) {
      setName(agent.data.name || '');
      setRole(agent.data.role || '');
      setDescription(agent.data.description || '');
      setSystemPrompt(agent.data.systemPrompt || '');
      setModel(agent.data.model || '');
      setColor(agent.data.color || '#6b6b6b');
      setHasChanges(false);
    }
  }, [agent]);

  // Track changes
  useEffect(() => {
    if (!agent) return;
    const changed =
      name !== agent.data.name ||
      role !== agent.data.role ||
      description !== agent.data.description ||
      systemPrompt !== agent.data.systemPrompt ||
      model !== agent.data.model ||
      color !== agent.data.color;
    setHasChanges(changed);
  }, [agent, name, role, description, systemPrompt, model, color]);

  if (!agent) return null;

  const handleSave = () => {
    if (!hasChanges) {
      onClose();
      return;
    }
    setShowConfirm(true);
  };

  const confirmSave = () => {
    onUpdate(agent.id, { name, role, description, systemPrompt, model, color, restartKey: Date.now() });
    setShowConfirm(false);
    setHasChanges(false);
    onClose();
  };

  const cancelSave = () => {
    setShowConfirm(false);
  };

  const handleApplyTemplate = (key) => {
    const tmpl = AGENT_TEMPLATES[key];
    setRole(tmpl.role);
    setDescription(tmpl.description);
    setSystemPrompt(tmpl.systemPrompt);
    setModel(tmpl.model);
    setColor(tmpl.color);
  };

  const MODELS = [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
  ];

  return (
    <div className="config-panel">
      <div className="config-header">
        <h3>Configure Agent</h3>
        <button className="config-close" onClick={onClose}>x</button>
      </div>

      {showConfirm && (
        <div className="config-confirm-overlay">
          <div className="config-confirm-dialog">
            <h4>Save Changes?</h4>
            <p>Do you want to save the changes to this agent?</p>
            <div className="config-confirm-actions">
              <button className="btn-confirm" onClick={confirmSave}>Save</button>
              <button className="btn-cancel" onClick={cancelSave}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="config-body">
        <div className="config-templates">
          <label>Apply Template:</label>
          <div className="template-btns">
            {Object.entries(AGENT_TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                className="template-btn"
                style={{ borderLeft: `3px solid ${tmpl.color}` }}
                onClick={() => handleApplyTemplate(key)}
              >
                {tmpl.role}
              </button>
            ))}
          </div>
        </div>

        <div className="config-field">
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="config-field">
          <label>Role</label>
          <input value={role} onChange={(e) => setRole(e.target.value)} />
        </div>

        <div className="config-field">
          <label>Color</label>
          <div className="color-row">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="color-picker"
            />
            <span className="color-hex">{color}</span>
          </div>
        </div>

        <div className="config-field">
          <label>Model</label>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="config-field">
          <label>Description</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="config-field">
          <label>System Prompt</label>
          <textarea
            rows={6}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
          />
        </div>

        <div className="config-actions">
          <button className="btn-save" onClick={handleSave} disabled={!hasChanges}>
            {hasChanges ? 'Save' : 'No Changes'}
          </button>
          <button className="btn-delete" onClick={() => onRemove(agent.id)}>Delete Agent</button>
        </div>
      </div>
    </div>
  );
}

export default AgentConfigPanel;
