const Anthropic = require('@anthropic-ai/sdk');

class AgentOrchestrator {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.client = null;
    this.agents = new Map();       // agentId -> agent config
    this.histories = new Map();    // agentId -> conversation messages[]
    this.edges = [];               // { source, target }
    this.activeCalls = new Map();  // agentId -> AbortController
  }

  configure({ authToken, baseURL }) {
    const opts = {};
    if (authToken) opts.apiKey = authToken;
    if (baseURL) opts.baseURL = baseURL;
    this.client = new Anthropic(opts);
  }

  isConfigured() {
    return this.client !== null;
  }

  syncAgents(agentConfigs) {
    for (const agent of agentConfigs) {
      this.agents.set(agent.id, agent.data);
      if (!this.histories.has(agent.id)) {
        this.histories.set(agent.id, []);
      }
    }
    // Clean up removed agents
    for (const id of this.agents.keys()) {
      if (!agentConfigs.find((a) => a.id === id)) {
        this.agents.delete(id);
        this.histories.delete(id);
      }
    }
  }

  syncEdges(edges) {
    this.edges = edges.map((e) => ({ source: e.source, target: e.target }));
  }

  getConnectedAgents(agentId) {
    const targets = this.edges
      .filter((e) => e.source === agentId)
      .map((e) => ({ id: e.target, ...this.agents.get(e.target) }))
      .filter((a) => a.role);
    const sources = this.edges
      .filter((e) => e.target === agentId)
      .map((e) => ({ id: e.source, ...this.agents.get(e.source) }))
      .filter((a) => a.role);
    return [...targets, ...sources];
  }

  buildTools(agentId) {
    const connected = this.getConnectedAgents(agentId);
    if (connected.length === 0) return [];

    return [
      {
        name: 'send_message',
        description: `Send a message to a connected agent. Available agents: ${connected.map((a) => `"${a.id}" (${a.role}: ${a.name})`).join(', ')}. Use this to delegate tasks, ask questions, or collaborate with other agents.`,
        input_schema: {
          type: 'object',
          properties: {
            target_agent_id: {
              type: 'string',
              description: `The ID of the agent to send the message to. Must be one of: ${connected.map((a) => a.id).join(', ')}`,
            },
            message: {
              type: 'string',
              description: 'The message to send to the target agent',
            },
          },
          required: ['target_agent_id', 'message'],
        },
      },
    ];
  }

  buildSystemPrompt(agentId) {
    const config = this.agents.get(agentId);
    if (!config) return 'You are a helpful assistant.';

    const connected = this.getConnectedAgents(agentId);
    let prompt = config.systemPrompt || `You are ${config.role}.`;

    if (connected.length > 0) {
      prompt += `\n\nYou are part of a multi-agent team. Connected agents:\n`;
      for (const a of connected) {
        prompt += `- ${a.id} (${a.role}: ${a.name}): ${a.description}\n`;
      }
      prompt += `\nYou can use the send_message tool to communicate with these agents. Collaborate actively - delegate tasks that match their expertise, ask for help when needed, and coordinate your work.`;
      prompt += `\nWhen you receive a message from another agent, respond helpfully and continue the collaboration.`;
      prompt += `\nKeep your responses concise and action-oriented.`;
    }

    return prompt;
  }

  emit(event, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, data);
    }
  }

  async sendToAgent(agentId, userMessage, fromAgentId = null) {
    if (!this.client) {
      this.emit('agent-error', { agentId, error: 'Not configured. Click "Settings" in the header to set Auth Token and Base URL.' });
      return;
    }

    const config = this.agents.get(agentId);
    if (!config) {
      this.emit('agent-error', { agentId, error: 'Agent not found' });
      return;
    }

    // Build the message content
    let content = userMessage;
    if (fromAgentId) {
      const fromConfig = this.agents.get(fromAgentId);
      const fromName = fromConfig ? `${fromConfig.role} (${fromConfig.name})` : fromAgentId;
      content = `[Message from ${fromName}]: ${userMessage}`;
    }

    // Add to history
    const history = this.histories.get(agentId) || [];
    history.push({ role: 'user', content });
    this.histories.set(agentId, history);

    // Notify status
    this.emit('agent-status', { agentId, status: 'running' });

    try {
      const tools = this.buildTools(agentId);
      const systemPrompt = this.buildSystemPrompt(agentId);

      const requestParams = {
        model: config.model || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: history.slice(-20), // Keep last 20 messages for context
      };
      if (tools.length > 0) {
        requestParams.tools = tools;
      }

      // Use async iteration to ensure all chunks are processed before continuing
      const stream = this.client.messages.stream(requestParams);

      let fullText = '';
      let toolUses = [];

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          fullText += text;
          this.emit('agent-stream', { agentId, text });
        }
      }

      const finalMessage = await stream.finalMessage();

      // Process tool uses
      for (const block of finalMessage.content) {
        if (block.type === 'tool_use') {
          toolUses.push(block);
        }
      }

      // Add assistant response to history
      history.push({ role: 'assistant', content: finalMessage.content });
      this.histories.set(agentId, history);

      // Handle tool calls (send_message to other agents)
      if (toolUses.length > 0) {
        for (const toolUse of toolUses) {
          if (toolUse.name === 'send_message') {
            const { target_agent_id, message } = toolUse.input;

            // Notify the UI about the message routing
            this.emit('agent-message-sent', {
              fromAgentId: agentId,
              toAgentId: target_agent_id,
              message,
            });

            // Add tool result to history
            history.push({
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUse.id,
                  content: `Message sent to ${target_agent_id}. Waiting for their response...`,
                },
              ],
            });
            this.histories.set(agentId, history);

            // Actually send to the target agent
            const response = await this.sendToAgentAndCollect(target_agent_id, message, agentId);

            if (response) {
              // Feed the response back to the original agent
              history.push({
                role: 'user',
                content: `[Response from ${this.agents.get(target_agent_id)?.role || target_agent_id}]: ${response}`,
              });
              this.histories.set(agentId, history);

              // Let the original agent continue with the response
              this.emit('agent-stream', { agentId, text: '\n' });
              console.log('[Orchestrator] Calling continueAgent for', agentId);
              await this.continueAgent(agentId);
              console.log('[Orchestrator] continueAgent completed for', agentId);
            }
          }
        }
        // Don't emit agent-done here - continueAgent will handle it
      } else {
        // No tool calls, we're done
        console.log('[Orchestrator] No tool calls, emitting agent-done for', agentId);
        this.emit('agent-status', { agentId, status: 'idle' });
        this.emit('agent-done', { agentId });
      }

    } catch (err) {
      this.emit('agent-error', { agentId, error: err.message || String(err) });
      this.emit('agent-status', { agentId, status: 'error' });
    }
  }

  // Send a message and collect the full response text (for feeding back to caller)
  async sendToAgentAndCollect(agentId, userMessage, fromAgentId) {
    if (!this.client) return null;

    const config = this.agents.get(agentId);
    if (!config) return null;

    const fromConfig = this.agents.get(fromAgentId);
    const fromName = fromConfig ? `${fromConfig.role} (${fromConfig.name})` : fromAgentId;
    const content = `[Message from ${fromName}]: ${userMessage}`;

    const history = this.histories.get(agentId) || [];
    history.push({ role: 'user', content });
    this.histories.set(agentId, history);

    this.emit('agent-status', { agentId, status: 'running' });

    try {
      const systemPrompt = this.buildSystemPrompt(agentId);
      // Don't give tools to sub-agents to prevent infinite recursion for now
      const requestParams = {
        model: config.model || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: history.slice(-20),
      };

      const stream = this.client.messages.stream(requestParams);

      let fullText = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const text = event.delta.text;
          fullText += text;
          this.emit('agent-stream', { agentId, text });
        }
      }

      const finalMessage = await stream.finalMessage();

      history.push({ role: 'assistant', content: finalMessage.content });
      this.histories.set(agentId, history);

      this.emit('agent-status', { agentId, status: 'idle' });
      this.emit('agent-done', { agentId });

      return fullText;
    } catch (err) {
      this.emit('agent-error', { agentId, error: err.message || String(err) });
      this.emit('agent-status', { agentId, status: 'error' });
      return null;
    }
  }

  // Continue an agent's conversation after receiving tool results
  async continueAgent(agentId) {
    const config = this.agents.get(agentId);
    if (!config || !this.client) return;

    const history = this.histories.get(agentId) || [];
    const systemPrompt = this.buildSystemPrompt(agentId);

    this.emit('agent-status', { agentId, status: 'running' });

    try {
      const requestParams = {
        model: config.model || 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        messages: history.slice(-20),
      };

      const stream = this.client.messages.stream(requestParams);

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          this.emit('agent-stream', { agentId, text: event.delta.text });
        }
      }

      const finalMessage = await stream.finalMessage();

      history.push({ role: 'assistant', content: finalMessage.content });
      this.histories.set(agentId, history);

      console.log('[Orchestrator] continueAgent finished, emitting agent-done for', agentId);
      this.emit('agent-status', { agentId, status: 'idle' });
      this.emit('agent-done', { agentId });
    } catch (err) {
      this.emit('agent-error', { agentId, error: err.message || String(err) });
      this.emit('agent-status', { agentId, status: 'error' });
    }
  }

  clearHistory(agentId) {
    this.histories.set(agentId, []);
  }

  clearAllHistory() {
    for (const id of this.histories.keys()) {
      this.histories.set(id, []);
    }
  }
}

module.exports = { AgentOrchestrator };
