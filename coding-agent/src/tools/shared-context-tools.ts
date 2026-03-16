import type { Tool, ToolContext, ToolResult } from './tool-registry.js';
import { sharedContext } from '../context/shared-store.js';

export const setSharedContextTool: Tool = {
  id: 'set_shared_context',
  description: 'Store data in shared context accessible by all agents',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Context key (e.g., "findings", "plan", "issues")'
      },
      value: {
        type: 'string',
        description: 'Value to store (will be parsed as JSON if possible)'
      },
      ttl: {
        type: 'number',
        description: 'Time to live in milliseconds (optional)'
      }
    },
    required: ['key', 'value']
  },
  async execute(
    args: { key: string; value: string; ttl?: number },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      // Try to parse as JSON
      let parsedValue: any;
      try {
        parsedValue = JSON.parse(args.value);
      } catch {
        parsedValue = args.value;
      }

      const id = sharedContext.set(args.key, parsedValue, context.agentId, args.ttl);

      return {
        success: true,
        data: {
          id,
          key: args.key,
          stored: true
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

export const getSharedContextTool: Tool = {
  id: 'get_shared_context',
  description: 'Retrieve data from shared context',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Context key to retrieve'
      }
    },
    required: ['key']
  },
  async execute(
    args: { key: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      const value = sharedContext.get(args.key);

      if (value === undefined) {
        return {
          success: false,
          error: `Key "${args.key}" not found in shared context`
        };
      }

      return {
        success: true,
        data: {
          key: args.key,
          value
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

export const listSharedContextTool: Tool = {
  id: 'list_shared_context',
  description: 'List all keys in shared context',
  parameters: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Optional regex pattern to filter keys'
      }
    }
  },
  async execute(
    args: { pattern?: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      let entries = sharedContext.entries();

      if (args.pattern) {
        entries = sharedContext.search(args.pattern);
      }

      return {
        success: true,
        data: {
          entries: entries.map(e => ({
            key: e.key,
            agentId: e.agentId,
            timestamp: e.timestamp
          })),
          count: entries.length
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

export const deleteSharedContextTool: Tool = {
  id: 'delete_shared_context',
  description: 'Delete a key from shared context',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'Context key to delete'
      }
    },
    required: ['key']
  },
  async execute(
    args: { key: string },
    _context: ToolContext
  ): Promise<ToolResult> {
    try {
      sharedContext.delete(args.key);

      return {
        success: true,
        data: {
          key: args.key,
          deleted: true
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
