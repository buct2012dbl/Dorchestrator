import React, { memo, useEffect } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';
import { STATUS_COLORS } from '../store/agentStore';
import './AgentNode.css';

const AgentNode = memo(({ id, data, selected }) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.idle;

  useEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    data.name,
    data.role,
    data.description,
    data.model,
    data.color,
    updateNodeInternals,
  ]);

  return (
    <div
      className={`agent-node ${selected ? 'selected' : ''}`}
      style={{ borderColor: data.color, '--status-color': statusColor }}
    >
      <Handle type="target" position={Position.Top} className="agent-handle" />
      <div className="agent-node-header" style={{ background: data.color }}>
        <span className="agent-role">{data.role}</span>
        <span className="agent-status-dot" style={{ background: statusColor }} />
      </div>
      <div className="agent-node-body">
        <div className="agent-name">{data.name}</div>
        <div className="agent-desc">{data.description}</div>
        <div className="agent-model">{data.model}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className="agent-handle" />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
export default AgentNode;
