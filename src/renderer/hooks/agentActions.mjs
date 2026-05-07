export function createAgentNode(template, id, position, idleStatus) {
  return {
    id,
    type: 'agentNode',
    position: position || { x: 300, y: 300 },
    data: {
      ...template,
      id,
      status: idleStatus,
      name: template.name || template.role,
      unreadCount: 0,
      latestNotification: null,
      gitBranch: null,
    },
  };
}

export function appendAgent(agents, template, options) {
  const { generateId, position, idleStatus } = options;
  const id = generateId(new Set(agents.map((agent) => agent.id)));
  return {
    id,
    agents: [
      ...agents,
      createAgentNode(template, id, position, idleStatus),
    ],
  };
}
