import React, { useCallback, useEffect, useRef, useState } from 'react';
import GraphView from './components/GraphView';
import TerminalGrid from './components/TerminalGrid';
import AgentConfigPanel from './components/AgentConfigPanel';
import VoiceAssistant from './components/VoiceAssistant';
import MuxWorkspace from './components/mux/MuxWorkspace';
import SwarmSidebar from './components/swarm/SwarmSidebar';
import { createDefaultSwarmGraph, useAgents } from './hooks/useAgents';
import { NODE_STATUS } from './store/agentStore';
import './App.css';

function GraphIcon() {
  return (
    <svg className="view-toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M5 14.5 10 5.5 15 14.5" />
      <circle cx="5" cy="14.5" r="1.75" />
      <circle cx="10" cy="5.5" r="1.75" />
      <circle cx="15" cy="14.5" r="1.75" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg className="view-toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4.5 6.25 8.5 10l-4 3.75" />
      <path d="M10 13.75h5.5" />
      <rect x="2.5" y="3" width="15" height="14" rx="1.5" />
    </svg>
  );
}

function ViewToggleLabel({ icon, label, expanded }) {
  return (
    <span className="view-toggle-content">
      {icon}
      {expanded && <span>{label}</span>}
    </span>
  );
}

function cloneGraphData(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildSwarmSnapshotMap(swarms) {
  const snapshots = {};
  for (const swarm of swarms || []) {
    snapshots[swarm.id] = {
      agents: cloneGraphData(swarm.agents || []),
      edges: cloneGraphData(swarm.edges || []),
    };
  }
  return snapshots;
}

function buildSwarmId() {
  return `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildNextSwarmName(swarms) {
  const maxNumber = swarms.reduce((max, swarm) => {
    const match = swarm.name?.match(/^Swarm (\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `Swarm ${maxNumber + 1}`;
}

function createSwarmRecord(name, id = buildSwarmId()) {
  const graph = createDefaultSwarmGraph(id);
  const now = new Date().toISOString();
  return {
    id,
    name,
    agents: graph.agents,
    edges: graph.edges,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeSwarmName(value) {
  return value.trim().replace(/\s+/g, ' ');
}

function SwarmNameModal({
  mode,
  value,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  const title = mode === 'rename' ? 'Rename Swarm' : 'Create Swarm';
  const description = mode === 'rename'
    ? 'Update the swarm label shown in the sidebar and header.'
    : 'Choose a name for the new swarm before it is created.';

  return (
    <div className="config-confirm-overlay" onClick={onClose}>
      <div className="swarm-name-modal" onClick={(e) => e.stopPropagation()}>
        <div className="swarm-name-modal-header">
          <h4>{title}</h4>
          <p>{description}</p>
        </div>
        <form className="swarm-name-form" onSubmit={onSubmit}>
          <label htmlFor="swarm-name-input">Name</label>
          <input
            id="swarm-name-input"
            className="swarm-name-input"
            value={value}
            maxLength={80}
            autoFocus
            onChange={(e) => onChange(e.target.value)}
          />
          {error && <div className="swarm-name-error">{error}</div>}
          <div className="config-confirm-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-confirm">{mode === 'rename' ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function App() {
  const {
    agents,
    setAgents,
    edges,
    setEdges,
    selectedAgent,
    setSelectedAgent,
    addAgent,
    removeAgent,
    updateAgent,
    updateAgentStatus,
    addNotification,
    clearNotifications,
  } = useAgents();

  const [showConfig, setShowConfig] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [showGraph, setShowGraph] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [authTokenInput, setAuthTokenInput] = useState('');
  const [baseURLInput, setBaseURLInput] = useState('');
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [swarmLoading, setSwarmLoading] = useState(false);
  const [terminalKey, setTerminalKey] = useState(0);
  const [mode, setMode] = useState('swarm');
  const [swarms, setSwarms] = useState([]);
  const [selectedSwarmId, setSelectedSwarmId] = useState(null);
  const [isSwarmSidebarCollapsed, setIsSwarmSidebarCollapsed] = useState(false);
  const [showDeleteSwarmConfirm, setShowDeleteSwarmConfirm] = useState(false);
  const [deleteSwarmId, setDeleteSwarmId] = useState(null);
  const [swarmModalState, setSwarmModalState] = useState(null);
  const [swarmNameInput, setSwarmNameInput] = useState('');
  const [swarmNameError, setSwarmNameError] = useState('');
  const [activeMuxTerminalId, setActiveMuxTerminalId] = useState(null);
  const termGridRef = useRef(null);
  const hydratingSwarmIdRef = useRef(null);
  const graphStateSwarmIdRef = useRef(null);
  const swarmSnapshotsRef = useRef({});

  const activeSwarm = swarms.find((swarm) => swarm.id === selectedSwarmId) || null;

  const loadSwarmsForWorkspace = useCallback(async () => {
    if (!window.electronAPI || !workspace) {
      setSwarms([]);
      setSelectedSwarmId(null);
      setSwarmLoading(false);
      return;
    }

    setSwarmLoading(true);

    try {
      const [loadedSwarms, savedSelectedSwarmId] = await Promise.all([
        window.electronAPI.loadSwarms(),
        window.electronAPI.getSelectedSwarm(),
      ]);

      const nextSwarms = loadedSwarms || [];
      swarmSnapshotsRef.current = buildSwarmSnapshotMap(nextSwarms);

      const nextSelectedSwarmId = nextSwarms.some((swarm) => swarm.id === savedSelectedSwarmId)
        ? savedSelectedSwarmId
        : nextSwarms[0]?.id || null;

      await window.electronAPI.setSelectedSwarm(nextSelectedSwarmId);
      setSwarms(nextSwarms);
      setSelectedSwarmId(nextSelectedSwarmId);
    } catch (err) {
      console.error('[App] Failed to load swarms:', err);
      setSwarms([]);
      setSelectedSwarmId(null);
    } finally {
      setSwarmLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    if (mode !== 'mux') return;

    const handleKeyDown = (e) => {
      if (e.metaKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        const index = parseInt(e.key, 10) - 1;
        if (agents[index]) {
          setSelectedAgent(agents[index].id);
        }
      } else if (e.metaKey && e.shiftKey && e.key === ']') {
        e.preventDefault();
        const currentIndex = agents.findIndex((agent) => agent.id === selectedAgent);
        const nextIndex = (currentIndex + 1) % agents.length;
        if (agents[nextIndex]) {
          setSelectedAgent(agents[nextIndex].id);
        }
      } else if (e.metaKey && e.shiftKey && e.key === '[') {
        e.preventDefault();
        const currentIndex = agents.findIndex((agent) => agent.id === selectedAgent);
        const prevIndex = (currentIndex - 1 + agents.length) % agents.length;
        if (agents[prevIndex]) {
          setSelectedAgent(agents[prevIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, agents, selectedAgent, setSelectedAgent]);

  useEffect(() => {
    if (!window.electronAPI) {
      setWorkspaceLoading(false);
      return;
    }

    Promise.all([
      window.electronAPI.getWorkspace(),
      window.electronAPI.isConfigured(),
    ]).then(([ws, configured]) => {
      setWorkspace(ws);
      setIsConfigured(configured);
      setWorkspaceLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!workspace) {
      setSwarmLoading(false);
      return;
    }
    loadSwarmsForWorkspace();
  }, [workspace, loadSwarmsForWorkspace]);

  useEffect(() => {
    if (!activeSwarm) {
      hydratingSwarmIdRef.current = null;
      graphStateSwarmIdRef.current = null;
      setAgents([]);
      setEdges([]);
      setSelectedAgent(null);
      return;
    }

    hydratingSwarmIdRef.current = activeSwarm.id;
    graphStateSwarmIdRef.current = activeSwarm.id;
    const snapshot = swarmSnapshotsRef.current[activeSwarm.id] || {
      agents: activeSwarm.agents || [],
      edges: activeSwarm.edges || [],
    };
    setAgents(cloneGraphData(snapshot.agents || []));
    setEdges(cloneGraphData(snapshot.edges || []));
    setSelectedAgent(null);
    setShowConfig(false);
    setTerminalKey((key) => key + 1);
  }, [activeSwarm?.id, setAgents, setEdges, setSelectedAgent]);

  const persistSwarmGraph = useCallback((swarmId, nextAgents, nextEdges, options = {}) => {
    if (!window.electronAPI || !swarmId) {
      return;
    }

    const clonedAgents = cloneGraphData(nextAgents);
    const clonedEdges = cloneGraphData(nextEdges);
    swarmSnapshotsRef.current[swarmId] = {
      agents: clonedAgents,
      edges: clonedEdges,
    };

    const updatedAt = new Date().toISOString();
    const currentSwarm = swarms.find((swarm) => swarm.id === swarmId);
    if (!currentSwarm) {
      return;
    }

    const nextSwarm = {
      ...currentSwarm,
      agents: clonedAgents,
      edges: clonedEdges,
      updatedAt,
    };

    if (options.updateList) {
      setSwarms((prev) => prev.map((swarm) => (
        swarm.id === swarmId ? nextSwarm : swarm
      )));
    }

    window.electronAPI.saveSwarm(nextSwarm);
  }, [swarms]);

  useEffect(() => {
    const graphSwarmId = graphStateSwarmIdRef.current;

    if (!window.electronAPI || !graphSwarmId || swarmLoading) {
      return;
    }

    if (hydratingSwarmIdRef.current === graphSwarmId) {
      hydratingSwarmIdRef.current = null;
      return;
    }

    persistSwarmGraph(graphSwarmId, agents, edges);
    window.electronAPI.syncAgents({ agents, edges });
  }, [agents, edges, persistSwarmGraph, swarmLoading]);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubs = [];
    const statusUpdateTimers = {};

    unsubs.push(window.electronAPI.onPtyData(({ agentId, data }) => {
      const term = termGridRef.current?.getTerminal(agentId);
      term?.write(data);

      if (statusUpdateTimers[agentId]) {
        clearTimeout(statusUpdateTimers[agentId]);
      }
      statusUpdateTimers[agentId] = setTimeout(() => {
        updateAgentStatus(agentId, NODE_STATUS.SUCCESS);
        delete statusUpdateTimers[agentId];
      }, 500);
    }));

    unsubs.push(window.electronAPI.onPtyExit(({ agentId }) => {
      const term = termGridRef.current?.getTerminal(agentId);
      term?.notifyExit();

      if (statusUpdateTimers[agentId]) {
        clearTimeout(statusUpdateTimers[agentId]);
        delete statusUpdateTimers[agentId];
      }

      updateAgentStatus(agentId, NODE_STATUS.IDLE);
    }));

    unsubs.push(window.electronAPI.onAgentNotification(({ agentId, message }) => {
      console.log(`[Notification] ${agentId}: ${message}`);
      addNotification(agentId, message);
    }));

    return () => {
      Object.values(statusUpdateTimers).forEach(clearTimeout);
      unsubs.forEach((unsub) => unsub());
    };
  }, [updateAgentStatus, addNotification]);

  const handleSelectFolder = useCallback(async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;

    await window.electronAPI.setWorkspace({ workspacePath: folderPath });
    setWorkspace(folderPath);
    setTerminalKey((key) => key + 1);
  }, []);

  const handleNodeSelect = useCallback((id) => {
    setSelectedAgent(id);
    setShowConfig(true);
  }, [setSelectedAgent]);

  const handleConfigClose = useCallback(() => {
    setShowConfig(false);
  }, []);

  const handleSaveSettings = useCallback(async () => {
    if (!authTokenInput.trim()) return;

    try {
      if (window.electronAPI) {
        await window.electronAPI.configure({
          authToken: authTokenInput.trim(),
          baseURL: baseURLInput.trim() || undefined,
        });
      }
      setIsConfigured(true);
      setShowSettings(false);
      setAuthTokenInput('');
      setBaseURLInput('');
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, [authTokenInput, baseURLInput]);

  const handleMouseDown = useCallback(() => setIsDragging(true), []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !showGraph || !showTerminal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSplitRatio(Math.max(20, Math.min(80, ((e.clientY - rect.top) / rect.height) * 100)));
  }, [isDragging, showGraph, showTerminal]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleVoiceTranscript = useCallback((text) => {
    if (mode === 'mux') {
      if (activeMuxTerminalId) {
        window.electronAPI?.muxPtyInput({ terminalId: activeMuxTerminalId, data: text });
      }
      return;
    }

    if (termGridRef.current) {
      termGridRef.current.sendTextToFocused(text);
    }
  }, [activeMuxTerminalId, mode]);

  const handleSelectSwarm = useCallback(async (id) => {
    const currentGraphSwarmId = graphStateSwarmIdRef.current;

    if (id === currentGraphSwarmId) {
      await window.electronAPI?.setSelectedSwarm(id);
      return;
    }

    if (currentGraphSwarmId) {
      persistSwarmGraph(currentGraphSwarmId, agents, edges, { updateList: true });
    }

    setSelectedSwarmId(id);
    await window.electronAPI?.setSelectedSwarm(id);
  }, [agents, edges, persistSwarmGraph]);

  const openCreateSwarmModal = useCallback(() => {
    setSwarmModalState({ mode: 'create', swarmId: null });
    setSwarmNameInput(buildNextSwarmName(swarms));
    setSwarmNameError('');
  }, [swarms]);

  const openRenameSwarmModal = useCallback((id) => {
    const swarm = swarms.find((item) => item.id === id);
    if (!swarm) return;
    setSwarmModalState({ mode: 'rename', swarmId: id });
    setSwarmNameInput(swarm.name || '');
    setSwarmNameError('');
  }, [swarms]);

  const closeSwarmModal = useCallback(() => {
    setSwarmModalState(null);
    setSwarmNameInput('');
    setSwarmNameError('');
  }, []);

  const handleSubmitSwarmModal = useCallback(async (e) => {
    e.preventDefault();

    if (!swarmModalState) return;

    const nextName = normalizeSwarmName(swarmNameInput);
    if (!nextName) {
      setSwarmNameError('Swarm name is required.');
      return;
    }

    const duplicate = swarms.find((swarm) => (
      swarm.id !== swarmModalState.swarmId
      && swarm.name?.trim().toLowerCase() === nextName.toLowerCase()
    ));
    if (duplicate) {
      setSwarmNameError('Swarm name must be unique in this workspace.');
      return;
    }

    if (swarmModalState.mode === 'rename') {
      const existingSwarm = swarms.find((swarm) => swarm.id === swarmModalState.swarmId);
      if (!existingSwarm) {
        closeSwarmModal();
        return;
      }

      const renamedSwarm = {
        ...existingSwarm,
        name: nextName,
      };
      swarmSnapshotsRef.current[renamedSwarm.id] = {
        agents: cloneGraphData(renamedSwarm.agents || []),
        edges: cloneGraphData(renamedSwarm.edges || []),
      };
      await window.electronAPI?.saveSwarm(renamedSwarm);
      setSwarms((prev) => prev.map((swarm) => (
        swarm.id === renamedSwarm.id ? renamedSwarm : swarm
      )));
      closeSwarmModal();
      return;
    }

    const newSwarm = createSwarmRecord(nextName);
    swarmSnapshotsRef.current[newSwarm.id] = {
      agents: cloneGraphData(newSwarm.agents || []),
      edges: cloneGraphData(newSwarm.edges || []),
    };
    await window.electronAPI?.saveSwarm(newSwarm);
    setSwarms((prev) => [...prev, newSwarm]);
    setSelectedSwarmId(newSwarm.id);
    await window.electronAPI?.setSelectedSwarm(newSwarm.id);
    closeSwarmModal();
  }, [closeSwarmModal, swarmModalState, swarmNameInput, swarms]);

  const handleDeleteSwarm = useCallback((id) => {
    setDeleteSwarmId(id);
    setShowDeleteSwarmConfirm(true);
  }, []);

  const confirmDeleteSwarm = useCallback(async () => {
    const swarmId = deleteSwarmId;
    if (!swarmId) return;

    const remainingSwarms = swarms.filter((swarm) => swarm.id !== swarmId);
    await window.electronAPI?.deleteSwarm(swarmId);

    const nextSwarms = remainingSwarms;
    delete swarmSnapshotsRef.current[swarmId];

    const nextSelectedSwarmId = selectedSwarmId === swarmId
      ? nextSwarms[0]?.id || null
      : selectedSwarmId;

    setSwarms(nextSwarms);
    setSelectedSwarmId(nextSelectedSwarmId);
    await window.electronAPI?.setSelectedSwarm(nextSelectedSwarmId);
    setShowDeleteSwarmConfirm(false);
    setDeleteSwarmId(null);
  }, [deleteSwarmId, selectedSwarmId, swarms]);

  const selectedAgentData = agents.find((agent) => agent.id === selectedAgent);

  if (workspaceLoading) return null;

  if (!workspace) {
    return (
      <div className="workspace-picker-overlay">
        <div className="workspace-picker-modal">
          <h2>Set Workspace</h2>
          <p>Choose a folder where your agents will work. Claude will have access to files in this directory.</p>
          <button className="workspace-browse-btn" onClick={handleSelectFolder}>
            Browse...
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="header">
        <h1>Dorchestrator</h1>
        <div className="header-controls">
          <div className="mode-toggle">
            <button
              className={`mode-btn ${mode === 'swarm' ? 'active' : ''}`}
              onClick={() => { setMode('swarm'); setShowConfig(false); }}
            >
              Swarm
            </button>
            <button
              className={`mode-btn ${mode === 'mux' ? 'active' : ''}`}
              onClick={() => { setMode('mux'); setShowConfig(false); }}
            >
              Mux
            </button>
          </div>
          <button className="workspace-btn" onClick={handleSelectFolder} title={workspace}>
            <span className="workspace-icon">▸</span>
            <span className="workspace-path">{formatWorkspacePath(workspace)}</span>
          </button>
          {mode === 'swarm' && activeSwarm && (
            <span className="header-info-text">Active {activeSwarm.name}</span>
          )}
          {mode === 'swarm' && <span className="header-info-text">{agents.length} agents</span>}
          {mode === 'swarm' && <span className="header-info-text">{edges.length} connections</span>}
          {mode === 'swarm' && (
            <button
              className="view-toggle-btn"
              onClick={() => setShowGraph(!showGraph)}
              title={showGraph ? 'Hide Graph' : 'Show Graph'}
            >
              <ViewToggleLabel icon={<GraphIcon />} label="GRAPH" expanded={showGraph} />
            </button>
          )}
          {mode === 'swarm' && (
            <button
              className="view-toggle-btn"
              onClick={() => setShowTerminal(!showTerminal)}
              title={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
            >
              <ViewToggleLabel icon={<TerminalIcon />} label="TERM" expanded={showTerminal} />
            </button>
          )}
        </div>
      </div>

      <div className="main-layout">
        {mode === 'swarm' ? (
          <>
            <div className={`swarm-sidebar-shell ${isSwarmSidebarCollapsed ? 'collapsed' : ''}`}>
              <div className="swarm-sidebar-divider-hitbox">
                <button
                  type="button"
                  className="swarm-sidebar-toggle swarm-sidebar-close-toggle"
                  aria-label="Close swarms sidebar"
                  onClick={() => setIsSwarmSidebarCollapsed(true)}
                >
                  &lt;
                </button>
              </div>
              <div className="swarm-sidebar-panel">
                <SwarmSidebar
                  swarms={swarms}
                  selectedSwarmId={selectedSwarmId}
                  onSelectSwarm={handleSelectSwarm}
                  onNewSwarm={openCreateSwarmModal}
                  onRenameSwarm={openRenameSwarmModal}
                  onDeleteSwarm={handleDeleteSwarm}
                />
              </div>
            </div>
            {isSwarmSidebarCollapsed && (
              <div className="swarm-sidebar-reopen-hitbox">
                <button
                  type="button"
                  className="swarm-sidebar-toggle swarm-sidebar-open-toggle"
                  aria-label="Open swarms sidebar"
                  onClick={() => setIsSwarmSidebarCollapsed(false)}
                >
                  &gt;
                </button>
              </div>
            )}
            <div className="center-panel">
              {swarmLoading ? (
                <div className="swarm-empty-state">Loading swarm workspace...</div>
              ) : activeSwarm ? (
                <>
                  <div
                    className="graph-section"
                    style={{
                      height: showTerminal ? `${splitRatio}%` : '100%',
                      display: showGraph ? 'block' : 'none',
                    }}
                  >
                    <GraphView
                      key={activeSwarm.id}
                      agents={agents}
                      edges={edges}
                      onAgentsChange={setAgents}
                      onEdgesChange={setEdges}
                      onNodeSelect={handleNodeSelect}
                      onAddAgent={addAgent}
                      onRemoveAgent={removeAgent}
                    />
                  </div>
                  {showGraph && showTerminal && (
                    <div
                      className={`split-handle ${isDragging ? 'dragging' : ''}`}
                      onMouseDown={handleMouseDown}
                    />
                  )}
                  <div
                    className="terminal-section"
                    style={{
                      height: showGraph ? `${100 - splitRatio}%` : '100%',
                      display: showTerminal ? 'block' : 'none',
                    }}
                  >
                    <TerminalGrid
                      key={terminalKey}
                      ref={termGridRef}
                      agents={agents}
                      selectedAgent={selectedAgent}
                      onSelectAgent={setSelectedAgent}
                    />
                  </div>
                </>
              ) : (
                <div className="swarm-empty-state swarm-empty-state-action">
                  <span>Create a swarm to start working in this workspace.</span>
                  <button className="workspace-browse-btn" onClick={openCreateSwarmModal}>Create Swarm</button>
                </div>
              )}
            </div>
          </>
        ) : (
          <MuxWorkspace onActiveTerminalChange={setActiveMuxTerminalId} />
        )}
        {mode === 'swarm' && showConfig && selectedAgentData && (
          <div className="config-sidebar">
            <AgentConfigPanel
              agent={selectedAgentData}
              onUpdate={updateAgent}
              onClose={handleConfigClose}
              onRemove={(id) => { removeAgent(id); handleConfigClose(); }}
            />
          </div>
        )}
      </div>

      {showDeleteSwarmConfirm && (
        <div className="config-confirm-overlay">
          <div className="config-confirm-dialog">
            <h4>Delete this swarm?</h4>
            <div className="config-confirm-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteSwarmConfirm(false)}>Cancel</button>
              <button className="btn-confirm" onClick={confirmDeleteSwarm}>OK</button>
            </div>
          </div>
        </div>
      )}

      {swarmModalState && (
        <SwarmNameModal
          mode={swarmModalState.mode}
          value={swarmNameInput}
          error={swarmNameError}
          onChange={(value) => {
            setSwarmNameInput(value);
            if (swarmNameError) {
              setSwarmNameError('');
            }
          }}
          onClose={closeSwarmModal}
          onSubmit={handleSubmitSwarmModal}
        />
      )}

      <VoiceAssistant onTranscript={handleVoiceTranscript} />
    </div>
  );
}

function formatWorkspacePath(fullPath) {
  if (!fullPath) return '';
  const home = fullPath.match(/^\/Users\/([^/]+)/)?.[0];
  const display = home ? fullPath.replace(home, '~') : fullPath;
  if (display.length > 40) return '...' + display.slice(-37);
  return display;
}

export default App;
