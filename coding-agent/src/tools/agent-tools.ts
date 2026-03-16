import type { Tool, ToolContext, ToolResult } from './tool-registry.js';
import { agentRegistry } from '../core/agent-registry.js';
import { sessionManager } from '../core/session.js';
import { messageBus } from '../core/message-bus.js';

export const sendMessageTool: Tool = {
  id: 'send_message',
  description: 'Send a message to another agent and wait for response',
  parameters: {
    type: 'object',
    properties: {
      agent_id: {
        type: 'string',
        description: 'Target agent ID (e.g., "explorer", "planner", "reviewer")'
      },
      message: {
        type: 'string',
        description: 'Message to send to the agent'
      }
    },
    required: ['agent_id', 'message']
  },
  async execute(
    args: { agent_id: string; message: string },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      const targetAgent = agentRegistry.get(args.agent_id);
      if (!targetAgent) {
        return {
          success: false,
          error: `Agent ${args.agent_id} not found`
        };
      }

      // Create child session
      const parentSession = sessionManager.current();
      const childSession = sessionManager.create(args.agent_id, parentSession.id);

      await messageBus.publish('agent:message', {
        from: context.agentId,
        to: args.agent_id,
        message: args.message
      }, {
        sessionId: childSession.id,
        agentId: args.agent_id
      });

      // Execute in child session context
      const response = await sessionManager.provideAsync(childSession, async () => {
        return await targetAgent.process(args.message);
      });

      await messageBus.publish('agent:response', {
        from: args.agent_id,
        to: context.agentId,
        response
      }, {
        sessionId: parentSession.id,
        agentId: context.agentId
      });

      return {
        success: true,
        data: {
          agent: args.agent_id,
          response
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

export const spawnAgentTool: Tool = {
  id: 'spawn_agent',
  description: 'Spawn a subagent for parallel work',
  parameters: {
    type: 'object',
    properties: {
      agent_type: {
        type: 'string',
        description: 'Type of agent to spawn (explorer, planner, reviewer)',
        enum: ['explorer', 'planner', 'reviewer']
      },
      task: {
        type: 'string',
        description: 'Task for the subagent to perform'
      }
    },
    required: ['agent_type', 'task']
  },
  async execute(
    args: { agent_type: string; task: string },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      // Find agent of requested type
      const agents = agentRegistry.getAllConfigs();
      const agentConfig = agents.find(a => a.type === args.agent_type);

      if (!agentConfig) {
        return {
          success: false,
          error: `No agent of type ${args.agent_type} found`
        };
      }

      const agent = agentRegistry.get(agentConfig.id);
      if (!agent) {
        return {
          success: false,
          error: `Agent ${agentConfig.id} not found`
        };
      }

      // Create child session
      const parentSession = sessionManager.current();
      const childSession = sessionManager.create(agentConfig.id, parentSession.id);

      await messageBus.publish('agent:spawn', {
        parent: context.agentId,
        child: agentConfig.id,
        task: args.task
      }, {
        sessionId: childSession.id,
        agentId: agentConfig.id
      });

      // Execute in child session context (non-blocking)
      const response = await sessionManager.provideAsync(childSession, async () => {
        return await agent.process(args.task);
      });

      return {
        success: true,
        data: {
          agent: agentConfig.id,
          type: args.agent_type,
          response
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

export const broadcastTool: Tool = {
  id: 'broadcast',
  description: 'Send a message to multiple agents in parallel',
  parameters: {
    type: 'object',
    properties: {
      agent_ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of agent IDs to broadcast to'
      },
      message: {
        type: 'string',
        description: 'Message to broadcast'
      }
    },
    required: ['agent_ids', 'message']
  },
  async execute(
    args: { agent_ids: string[]; message: string },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      const parentSession = sessionManager.current();

      // Execute all agents in parallel
      const promises = args.agent_ids.map(async (agentId) => {
        const agent = agentRegistry.get(agentId);
        if (!agent) {
          return {
            agent: agentId,
            success: false,
            error: 'Agent not found'
          };
        }

        const childSession = sessionManager.create(agentId, parentSession.id);

        try {
          const response = await sessionManager.provideAsync(childSession, async () => {
            return await agent.process(args.message);
          });

          return {
            agent: agentId,
            success: true,
            response
          };
        } catch (error) {
          return {
            agent: agentId,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      });

      const results = await Promise.all(promises);

      await messageBus.publish('agent:broadcast', {
        from: context.agentId,
        to: args.agent_ids,
        results
      }, {
        sessionId: parentSession.id,
        agentId: context.agentId
      });

      return {
        success: true,
        data: {
          results,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};
