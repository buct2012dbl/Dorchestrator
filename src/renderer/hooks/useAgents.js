import { useState, useCallback, useRef } from 'react';
import { AGENT_TEMPLATES, NODE_STATUS, STATUS_COLORS, generateId } from '../store/agentStore';

export function createDefaultSwarmGraph(swarmId = 'swarm-default') {
  const agentIds = {
    ceo: `${swarmId}-agent-ceo`,
    programmer: `${swarmId}-agent-programmer`,
    tester: `${swarmId}-agent-tester`,
  };

  return {
    agents: [
      {
        id: agentIds.ceo,
        type: 'agentNode',
        position: { x: 300, y: 50 },
        data: {
          ...AGENT_TEMPLATES.ceo,
          id: agentIds.ceo,
          status: NODE_STATUS.IDLE,
          name: 'CEO',
        },
      },
      {
        id: agentIds.programmer,
        type: 'agentNode',
        position: { x: 100, y: 250 },
        data: {
          ...AGENT_TEMPLATES.programmer,
          id: agentIds.programmer,
          status: NODE_STATUS.IDLE,
          name: 'Programmer',
        },
      },
      {
        id: agentIds.tester,
        type: 'agentNode',
        position: { x: 500, y: 250 },
        data: {
          ...AGENT_TEMPLATES.tester,
          id: agentIds.tester,
          status: NODE_STATUS.IDLE,
          name: 'Tester',
        },
      },
    ],
    edges: [
      { id: `${swarmId}-e-ceo-prog`, source: agentIds.ceo, target: agentIds.programmer, animated: true, style: { stroke: '#4a4a4a' } },
      { id: `${swarmId}-e-ceo-test`, source: agentIds.ceo, target: agentIds.tester, animated: true, style: { stroke: '#4a4a4a' } },
      { id: `${swarmId}-e-prog-test`, source: agentIds.programmer, target: agentIds.tester, animated: true, style: { stroke: '#4a4a4a' } },
    ],
  };
}

export function useAgents() {
  const defaultGraph = createDefaultSwarmGraph();
  const [agents, setAgents] = useState(defaultGraph.agents);
  const [edges, setEdges] = useState(defaultGraph.edges);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const terminalLogs = useRef({});

  const addAgent = useCallback((template, position) => {
    const tmpl = AGENT_TEMPLATES[template] || AGENT_TEMPLATES.custom;
    let newId = null;
    setAgents((prev) => {
      const id = generateId(new Set(prev.map((agent) => agent.id)));
      newId = id;
      return [
        ...prev,
        {
          id,
          type: 'agentNode',
          position: position || { x: 300, y: 300 },
          data: {
            ...tmpl,
            id,
            status: NODE_STATUS.IDLE,
            name: tmpl.role,
            unreadCount: 0,
            latestNotification: null,
            gitBranch: null,
          },
        },
      ];
    });
    return newId;
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

  const addNotification = useCallback((id, message) => {
    setAgents((prev) =>
      prev.map((a) =>
        a.id === id
          ? {
              ...a,
              data: {
                ...a.data,
                unreadCount: (a.data.unreadCount || 0) + 1,
                latestNotification: message,
              },
            }
          : a
      )
    );
  }, []);

  const clearNotifications = useCallback((id) => {
    updateAgent(id, { unreadCount: 0, latestNotification: null });
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
    addNotification,
    clearNotifications,
  };
}
