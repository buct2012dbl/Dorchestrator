import React, { memo, useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AgentNode from './AgentNode';
import { AGENT_TEMPLATES } from '../../store/agentStore';
import './GraphView.css';

const nodeTypes = { agentNode: AgentNode };

function GraphView({
  agents,
  edges,
  onAgentsChange,
  onEdgesChange,
  onNodeSelect,
  onAddAgent,
  onRemoveAgent,
  sharedAgents = [],
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const lastFitSizeRef = useRef({ width: 0, height: 0 });

  // Force ReactFlow to recalculate viewport when container resizes
  React.useEffect(() => {
    if (!reactFlowInstance) return;
    const observer = new ResizeObserver(() => {
      const width = reactFlowWrapper.current?.clientWidth || 0;
      const height = reactFlowWrapper.current?.clientHeight || 0;

      if (
        width === 0
        || height === 0
        || (lastFitSizeRef.current.width === width && lastFitSizeRef.current.height === height)
      ) {
        return;
      }

      lastFitSizeRef.current = { width, height };

      // Let React Flow recalculate after layout changes like opening the config sidebar.
      window.requestAnimationFrame(() => {
        reactFlowInstance.fitView({
          padding: 0.2,
          duration: 0,
        });
      });
    });
    if (reactFlowWrapper.current) observer.observe(reactFlowWrapper.current);
    return () => observer.disconnect();
  }, [reactFlowInstance]);

  const onConnect = useCallback(
    (params) => {
      const newEdge = { ...params, animated: true, style: { stroke: '#4a4a4a' } };
      onEdgesChange((prev) => addEdge(newEdge, prev));
    },
    [onEdgesChange]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  const handleNodesChange = useCallback(
    (changes) => {
      const persistentChanges = changes.filter((change) => change.type !== 'select');
      if (persistentChanges.length === 0) return;
      onAgentsChange((prev) => applyNodeChanges(persistentChanges, prev));
    },
    [onAgentsChange]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      const persistentChanges = changes.filter((change) => change.type !== 'select');
      if (persistentChanges.length === 0) return;
      onEdgesChange((prev) => applyEdgeChanges(persistentChanges, prev));
    },
    [onEdgesChange]
  );

  const onPaneContextMenu = useCallback(
    (event) => {
      event.preventDefault();
      if (!reactFlowInstance) return;
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        flowPosition: position,
      });
    },
    [reactFlowInstance]
  );

  const onNodeContextMenu = useCallback(
    (event, node) => {
      event.preventDefault();
      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      setContextMenu({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
        nodeId: node.id,
      });
    },
    []
  );

  const handleAddAgent = useCallback(
    (template) => {
      if (contextMenu?.flowPosition) {
        onAddAgent(template, contextMenu.flowPosition);
      }
      setContextMenu(null);
    },
    [contextMenu, onAddAgent]
  );

  const handleDeleteNode = useCallback(() => {
    if (contextMenu?.nodeId) {
      onRemoveAgent(contextMenu.nodeId);
    }
    setContextMenu(null);
  }, [contextMenu, onRemoveAgent]);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
  }, []);

  const availableAgents = sharedAgents.length > 0
    ? sharedAgents
    : Object.entries(AGENT_TEMPLATES).map(([key, tmpl]) => ({ id: key, ...tmpl }));

  return (
    <div className="graph-view" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={agents}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        onInit={setReactFlowInstance}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
      >
        <Controls />
        <MiniMap
          nodeColor={(n) => n.data?.color || '#6b6b6b'}
          style={{ background: '#252526' }}
        />
        <Background variant="dots" gap={16} size={1} color="#333" />
        <Panel position="top-left">
          <div className="graph-toolbar">
            {availableAgents.map((agent) => (
              <button
                key={agent.id}
                className="toolbar-btn"
                style={{ borderLeft: `3px solid ${agent.color}` }}
                onClick={() => onAddAgent(agent)}
              >
                + {agent.name || agent.role}
              </button>
            ))}
          </div>
        </Panel>
      </ReactFlow>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.nodeId ? (
            <>
              <button onClick={handleDeleteNode}>Delete Agent</button>
              <button onClick={() => { onNodeSelect(contextMenu.nodeId); setContextMenu(null); }}>
                Configure
              </button>
            </>
          ) : (
            <>
              <div className="context-menu-title">Add Agent</div>
              {availableAgents.map((agent) => (
                <button key={agent.id} onClick={() => handleAddAgent(agent)}>
                  <span className="ctx-dot" style={{ background: agent.color }} />
                  {agent.name || agent.role}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(GraphView);
