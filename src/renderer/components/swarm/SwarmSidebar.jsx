import React, { memo } from 'react';
import './SwarmSidebar.css';

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 13.75V16h2.25L14.5 7.75 12.25 5.5 4 13.75Z" />
      <path d="M11.75 6 14 8.25" />
      <path d="M13.25 4.5 15.5 6.75" />
    </svg>
  );
}

function SwarmSidebar({
  swarms,
  selectedSwarmId,
  onSelectSwarm,
  onNewSwarm,
  onRenameSwarm,
  onDeleteSwarm,
}) {
  return (
    <div className="swarm-sidebar">
      <div className="swarm-sidebar-header">
        <span className="swarm-sidebar-title">SWARMS</span>
        <button className="swarm-new-btn" onClick={onNewSwarm} title="Create swarm">+</button>
      </div>
      <div className="swarm-sidebar-list">
        {swarms.map((swarm, index) => (
          <div
            key={swarm.id}
            className={`swarm-sidebar-item ${selectedSwarmId === swarm.id ? 'active' : ''}`}
            onClick={() => onSelectSwarm(swarm.id)}
          >
            <div className="swarm-sidebar-item-header">
              <span className="swarm-sidebar-item-number">{index + 1}</span>
              <span className="swarm-sidebar-item-name">{swarm.name}</span>
            </div>
            <div className="swarm-sidebar-item-meta">
              <span>{swarm.agents?.length || 0} agents</span>
              <span>{swarm.edges?.length || 0} links</span>
            </div>
            <button
              className="swarm-sidebar-edit"
              title={`Rename ${swarm.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onRenameSwarm(swarm.id);
              }}
            >
              <EditIcon />
            </button>
            <button
              className="swarm-sidebar-delete"
              title={`Delete ${swarm.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSwarm(swarm.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(SwarmSidebar);
