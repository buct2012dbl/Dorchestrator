import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AgentNode from './AgentNode';
import { AGENT_TEMPLATES } from '../store/agentStore';
import './GraphView.css';

const nodeTypes = { agentNode: AgentNode };

function GraphView({ agents, edges, onAgentsChange, onEdgesChange, onNodeSelect, onAddAgent, onRemoveAgent }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(agents);
  const [edgesState, setEdges, onEdgesChangeInternal] = useEdgesState(edges);
  const [contextMenu, setContextMenu] = useState(null);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Sync external changes
  React.useEffect(() => { setNodes(agents); }, [agents, setNodes]);
  React.useEffect(() => { setEdges(edges); }, [edges, setEdges]);

  const onConnect = useCallback(
    (params) => {
      const newEdge = { ...params, animated: true, style: { stroke: '#4a4a4a' } };
      setEdges((eds) => addEdge(newEdge, eds));
      onEdgesChange((prev) => addEdge(newEdge, prev));
    },
    [setEdges, onEdgesChange]
  );

  const onNodeClick = useCallback(
    (event, node) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect]
  );

  const handleNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Sync position changes back
      const posChanges = changes.filter((c) => c.type === 'position' && c.position);
      if (posChanges.length > 0) {
        onAgentsChange((prev) =>
          prev.map((a) => {
            const change = posChanges.find((c) => c.id === a.id);
            return change ? { ...a, position: change.position } : a;
          })
        );
      }
    },
    [onNodesChange, onAgentsChange]
  );

  const handleEdgesChange = useCallback(
    (changes) => {
      onEdgesChangeInternal(changes);
      const removals = changes.filter((c) => c.type === 'remove');
      if (removals.length > 0) {
        const removeIds = removals.map((r) => r.id);
        onEdgesChange((prev) => prev.filter((e) => !removeIds.includes(e.id)));
      }
    },
    [onEdgesChangeInternal, onEdgesChange]
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

  return (
    <div className="graph-view" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edgesState}
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
            {Object.entries(AGENT_TEMPLATES).map(([key, tmpl]) => (
              <button
                key={key}
                className="toolbar-btn"
                style={{ borderLeft: `3px solid ${tmpl.color}` }}
                onClick={() => onAddAgent(key)}
              >
                + {tmpl.role}
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
              {Object.entries(AGENT_TEMPLATES).map(([key, tmpl]) => (
                <button key={key} onClick={() => handleAddAgent(key)}>
                  <span className="ctx-dot" style={{ background: tmpl.color }} />
                  {tmpl.role}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default GraphView;
