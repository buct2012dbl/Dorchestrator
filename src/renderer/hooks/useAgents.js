import { useState, useCallback, useRef, useEffect } from 'react';
import { AGENT_TEMPLATES, NODE_STATUS, STATUS_COLORS, generateId } from '../store/agentStore';

const DEFAULT_AGENTS = [
  {
    id: 'agent-ceo',
    type: 'agentNode',
    position: { x: 300, y: 50 },
    data: {
      ...AGENT_TEMPLATES.ceo,
      id: 'agent-ceo',
      status: NODE_STATUS.IDLE,
      name: 'CEO',
    },
  },
  {
    id: 'agent-programmer',
    type: 'agentNode',
    position: { x: 100, y: 250 },
    data: {
      ...AGENT_TEMPLATES.programmer,
      id: 'agent-programmer',
      status: NODE_STATUS.IDLE,
      name: 'Programmer',
    },
  },
  {
    id: 'agent-tester',
    type: 'agentNode',
    position: { x: 500, y: 250 },
    data: {
      ...AGENT_TEMPLATES.tester,
      id: 'agent-tester',
      status: NODE_STATUS.IDLE,
      name: 'Tester',
    },
  },
];

const DEFAULT_EDGES = [
  { id: 'e-ceo-prog', source: 'agent-ceo', target: 'agent-programmer', animated: true, style: { stroke: '#4a4a4a' } },
  { id: 'e-ceo-test', source: 'agent-ceo', target: 'agent-tester', animated: true, style: { stroke: '#4a4a4a' } },
  { id: 'e-prog-test', source: 'agent-programmer', target: 'agent-tester', animated: true, style: { stroke: '#4a4a4a' } },
];

export function useAgents() {
  const [agents, setAgents] = useState(DEFAULT_AGENTS);
  const [edges, setEdges] = useState(DEFAULT_EDGES);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const terminalLogs = useRef({});

  // Load saved graph config on mount
  useEffect(() => {
    if (!window.electronAPI || isLoaded) return;

    window.electronAPI.loadGraphConfig().then((config) => {
      if (config && config.agents && config.edges) {
        console.log('[useAgents] Loaded saved graph config:', config);
        setAgents(config.agents);
        setEdges(config.edges);
      } else {
        console.log('[useAgents] No saved config, using defaults');
      }
      setIsLoaded(true);
    }).catch((err) => {
      console.error('[useAgents] Failed to load config:', err);
      setIsLoaded(true);
    });
  }, [isLoaded]);

  const addAgent = useCallback((template, position) => {
    const id = generateId();
    const tmpl = AGENT_TEMPLATES[template] || AGENT_TEMPLATES.custom;
    const newNode = {
      id,
      type: 'agentNode',
      position: position || { x: 300, y: 300 },
      data: {
        ...tmpl,
        id,
        status: NODE_STATUS.IDLE,
        name: tmpl.role,
      },
    };
    setAgents((prev) => [...prev, newNode]);
    return id;
  }, []);

  const removeAgent = useCallback((id) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setEdges((prev) => prev.filter((e) => e.source !== id && e.target !== id));
    if (selectedAgent === id) setSelectedAgent(null);
  }, [selectedAgent]);

  const updateAgent = useCallback((id, updates) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, data: { ...a.data, ...updates } }
          : a
      )
    );
  }, []);

  const updateAgentStatus = useCallback((id, status) => {
    updateAgent(id, { status });
  }, [updateAgent]);

  const getConnectedAgents = useCallback((id) => {
    const targets = edges.filter((e) => e.source === id).map((e) => e.target);
    const sources = edges.filter((e) => e.target === id).map((e) => e.source);
    return { targets, sources };
  }, [edges]);

  const appendLog = useCallback((agentId, text) => {
    if (!terminalLogs.current[agentId]) {
      terminalLogs.current[agentId] = [];
    }
    terminalLogs.current[agentId].push(text);
  }, []);

  return {
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
    getConnectedAgents,
    appendLog,
    terminalLogs,
  };
}
