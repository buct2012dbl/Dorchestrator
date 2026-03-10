import React, { useCallback, useState, useEffect, useRef } from 'react';
import GraphView from './components/GraphView';
import TerminalGrid from './components/TerminalGrid';
import AgentConfigPanel from './components/AgentConfigPanel';
import VoiceAssistant from './components/VoiceAssistant';
import { useAgents } from './hooks/useAgents';
import { NODE_STATUS } from './store/agentStore';
import './App.css';

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
  const [terminalKey, setTerminalKey] = useState(0);
  const termGridRef = useRef(null);

  // Load workspace + config on mount
  useEffect(() => {
    if (!window.electronAPI) { setWorkspaceLoading(false); return; }
    Promise.all([
      window.electronAPI.getWorkspace(),
      window.electronAPI.isConfigured(),
    ]).then(([ws, configured]) => {
      setWorkspace(ws);
      setIsConfigured(configured);
      setWorkspaceLoading(false);
    });
  }, []);

  // Sync agents and edges to main process whenever they change
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.syncAgents({ agents, edges });
    }
  }, [agents, edges]);

  // Listen for PTY events (claude CLI sessions)
  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubs = [];
    const statusUpdateTimers = {};

    unsubs.push(window.electronAPI.onPtyData(({ agentId, data }) => {
      const term = termGridRef.current?.getTerminal(agentId);
      term?.write(data);

      // Debounce status updates to avoid rapid re-renders during initial load
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

      // Clear any pending status update
      if (statusUpdateTimers[agentId]) {
        clearTimeout(statusUpdateTimers[agentId]);
        delete statusUpdateTimers[agentId];
      }

      // Update status to idle when PTY exits (disconnected)
      updateAgentStatus(agentId, NODE_STATUS.IDLE);
    }));

    return () => {
      // Clear all timers on cleanup
      Object.values(statusUpdateTimers).forEach(clearTimeout);
      unsubs.forEach((unsub) => unsub());
    };
  }, [updateAgentStatus]);

  const handleSelectFolder = useCallback(async () => {
    const folderPath = await window.electronAPI.selectFolder();
    if (!folderPath) return;
    await window.electronAPI.setWorkspace({ workspacePath: folderPath });
    setWorkspace(folderPath);
    setTerminalKey((k) => k + 1); // remount all terminals with new cwd
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
  const handleMouseMove = useCallback(
    (e) => {
      if (!isDragging || !showGraph || !showTerminal) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setSplitRatio(Math.max(20, Math.min(80, ((e.clientY - rect.top) / rect.height) * 100)));
    },
    [isDragging, showGraph, showTerminal]
  );
  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  const handleVoiceTranscript = useCallback((text) => {
    // Send transcribed text to the focused terminal
    if (termGridRef.current) {
      termGridRef.current.sendTextToFocused(text);
    }
  }, []);

  const selectedAgentData = agents.find((a) => a.id === selectedAgent);

  if (workspaceLoading) return null;

  // Block the UI until workspace is chosen
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
          <button className="workspace-btn" onClick={handleSelectFolder} title={workspace}>
            <span className="workspace-icon">▸</span>
            <span className="workspace-path">{formatWorkspacePath(workspace)}</span>
          </button>
          <span className="header-info-text">{agents.length} agents</span>
          <span className="header-info-text">{edges.length} connections</span>
          <button
            className="view-toggle-btn"
            onClick={() => setShowGraph(!showGraph)}
            title={showGraph ? 'Hide Graph' : 'Show Graph'}
          >
            {showGraph ? '◈ GRAPH' : '◈'}
          </button>
          <button
            className="view-toggle-btn"
            onClick={() => setShowTerminal(!showTerminal)}
            title={showTerminal ? 'Hide Terminal' : 'Show Terminal'}
          >
            {showTerminal ? '▣ TERM' : '▣'}
          </button>
          <button
            className={`api-key-btn ${isConfigured ? 'has-key' : 'no-key'}`}
            onClick={() => setShowSettings(!showSettings)}
            title={isConfigured ? 'Configured' : 'Set Auth Token & Base URL'}
          >
            {isConfigured ? 'Configured' : 'Settings'}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="settings-bar">
          <div className="settings-field">
            <label>Auth Token</label>
            <input
              type="password"
              placeholder="Your auth token"
              value={authTokenInput}
              onChange={(e) => setAuthTokenInput(e.target.value)}
              autoFocus
            />
          </div>
          <div className="settings-field">
            <label>Base URL</label>
            <input
              type="text"
              placeholder="https://api.example.com (optional)"
              value={baseURLInput}
              onChange={(e) => setBaseURLInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveSettings()}
            />
          </div>
          <div className="settings-actions">
            <button onClick={handleSaveSettings}>Save</button>
            <button onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="main-layout">
        <div className="center-panel">
          <div
            className="graph-section"
            style={{
              height: showTerminal ? `${splitRatio}%` : '100%',
              display: showGraph ? 'block' : 'none'
            }}
          >
            <GraphView
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
              display: showTerminal ? 'block' : 'none'
            }}
          >
            <TerminalGrid
              key={terminalKey}
              ref={termGridRef}
              agents={agents}
              selectedAgent={selectedAgent}
            />
          </div>
        </div>
        {showConfig && selectedAgentData && (
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
      <VoiceAssistant onTranscript={handleVoiceTranscript} />
    </div>
  );
}

function formatWorkspacePath(fullPath) {
  if (!fullPath) return '';
  const home = fullPath.match(/^\/Users\/([^/]+)/)?.[0];
  const display = home ? fullPath.replace(home, '~') : fullPath;
  // Truncate from left if too long
  if (display.length > 40) return '...' + display.slice(-37);
  return display;
}

export default App;
