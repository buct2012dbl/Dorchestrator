import React from 'react';
import './SwarmSidebar.css';

function SwarmSidebar({ swarms, selectedSwarmId, onSelectSwarm, onNewSwarm, onDeleteSwarm }) {
  return (
    <div className="swarm-sidebar">
      <div className="swarm-sidebar-header">
        <span className="swarm-sidebar-title">SWARMS</span>
        <button className="swarm-new-btn" onClick={onNewSwarm}>+</button>
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
              className="swarm-sidebar-delete"
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

export default SwarmSidebar;
