import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import type { Tool, ToolContext, ToolResult } from '../../src/tools/tool-registry.js';

describe('ToolRegistry', () => {
  let registry: ToolRegistry;
  let mockTool: Tool;
  let mockContext: ToolContext;

  beforeEach(() => {
    registry = new ToolRegistry();

    mockContext = {
      sessionId: 'test-session',
      agentId: 'test-agent',
      workingDirectory: '/test'
    };

    mockTool = {
      id: 'test-tool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' }
        },
        required: ['input']
      },
      execute: vi.fn(async () => ({
        success: true,
        data: 'test result'
      }))
    };
  });

  describe('register', () => {
    it('should register tool', () => {
      registry.register(mockTool);

      expect(registry.has('test-tool')).toBe(true);
      expect(registry.get('test-tool')).toBe(mockTool);
    });

    it('should allow multiple tools', () => {
      const tool2 = { ...mockTool, id: 'tool-2' };

      registry.register(mockTool);
      registry.register(tool2);

      expect(registry.has('test-tool')).toBe(true);
      expect(registry.has('tool-2')).toBe(true);
    });

    it('should overwrite existing tool with same id', () => {
      const tool2 = { ...mockTool, description: 'Updated description' };

      registry.register(mockTool);
      registry.register(tool2);

      const retrieved = registry.get('test-tool');
      expect(retrieved?.description).toBe('Updated description');
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should retrieve registered tool', () => {
      const tool = registry.get('test-tool');

      expect(tool).toBe(mockTool);
    });

    it('should return undefined for non-existent tool', () => {
      const tool = registry.get('non-existent');

      expect(tool).toBeUndefined();
    });
  });

  describe('getForAgent', () => {
    beforeEach(() => {
      registry.register(mockTool);
      registry.register({ ...mockTool, id: 'tool-2' });
      registry.register({ ...mockTool, id: 'tool-3' });
    });

    it('should return tools allowed for agent', () => {
      const tools = registry.getForAgent('test-agent', ['test-tool', 'tool-2']);

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.id)).toEqual(['test-tool', 'tool-2']);
    });

    it('should filter out non-existent tools', () => {
      const tools = registry.getForAgent('test-agent', ['test-tool', 'non-existent', 'tool-2']);

      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.id)).toEqual(['test-tool', 'tool-2']);
    });

    it('should return empty array for empty allowed list', () => {
      const tools = registry.getForAgent('test-agent', []);

      expect(tools).toEqual([]);
    });

    it('should preserve order of allowed tools', () => {
      const tools = registry.getForAgent('test-agent', ['tool-3', 'test-tool', 'tool-2']);

      expect(tools.map(t => t.id)).toEqual(['tool-3', 'test-tool', 'tool-2']);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should execute tool with args and context', async () => {
      const args = { input: 'test' };
      const result = await registry.execute('test-tool', args, mockContext);

      expect(mockTool.execute).toHaveBeenCalledWith(args, mockContext);
      expect(result).toEqual({
        success: true,
        data: 'test result'
      });
    });

    it('should return error for non-existent tool', async () => {
      const result = await registry.execute('non-existent', {}, mockContext);

      expect(result).toEqual({
        success: false,
        error: 'Tool non-existent not found'
      });
    });

    it('should catch and return tool execution errors', async () => {
      const errorTool = {
        ...mockTool,
        execute: vi.fn(async () => {
          throw new Error('Tool execution failed');
        })
      };

      registry.register(errorTool);

      const result = await registry.execute('test-tool', {}, mockContext);

      expect(result).toEqual({
        success: false,
        error: 'Tool execution failed'
      });
    });

    it('should handle non-Error exceptions', async () => {
      const errorTool = {
        ...mockTool,
        execute: vi.fn(async () => {
          throw 'String error';
        })
      };

      registry.register(errorTool);

      const result = await registry.execute('test-tool', {}, mockContext);

      expect(result).toEqual({
        success: false,
        error: 'String error'
      });
    });
  });

  describe('getAll', () => {
    it('should return all registered tools', () => {
      registry.register(mockTool);
      registry.register({ ...mockTool, id: 'tool-2' });
      registry.register({ ...mockTool, id: 'tool-3' });

      const tools = registry.getAll();

      expect(tools).toHaveLength(3);
      expect(tools.map(t => t.id)).toContain('test-tool');
      expect(tools.map(t => t.id)).toContain('tool-2');
      expect(tools.map(t => t.id)).toContain('tool-3');
    });

    it('should return empty array when no tools', () => {
      const tools = registry.getAll();

      expect(tools).toEqual([]);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      registry.register(mockTool);
    });

    it('should return true for existing tool', () => {
      expect(registry.has('test-tool')).toBe(true);
    });

    it('should return false for non-existent tool', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    beforeEach(() => {
      registry.register(mockTool);
      registry.register({ ...mockTool, id: 'tool-2' });
    });

    it('should remove all tools', () => {
      registry.clear();

      expect(registry.getAll()).toEqual([]);
      expect(registry.has('test-tool')).toBe(false);
      expect(registry.has('tool-2')).toBe(false);
    });
  });

  describe('toAnthropicFormat', () => {
    it('should convert tools to Anthropic format', () => {
      const tools = [
        mockTool,
        {
          ...mockTool,
          id: 'tool-2',
          description: 'Second tool',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'number' }
            }
          }
        }
      ];

      const formatted = registry.toAnthropicFormat(tools);

      expect(formatted).toEqual([
        {
          name: 'test-tool',
          description: 'A test tool',
          input_schema: {
            type: 'object',
            properties: {
              input: { type: 'string' }
            },
            required: ['input']
          }
        },
        {
          name: 'tool-2',
          description: 'Second tool',
          input_schema: {
            type: 'object',
            properties: {
              value: { type: 'number' }
            }
          }
        }
      ]);
    });

    it('should handle empty tool list', () => {
      const formatted = registry.toAnthropicFormat([]);

      expect(formatted).toEqual([]);
    });
  });

  describe('toOpenAIFormat', () => {
    it('should convert tools to OpenAI format', () => {
      const tools = [
        mockTool,
        {
          ...mockTool,
          id: 'tool-2',
          description: 'Second tool',
          parameters: {
            type: 'object',
            properties: {
              value: { type: 'number' }
            }
          }
        }
      ];

      const formatted = registry.toOpenAIFormat(tools);

      expect(formatted).toEqual([
        {
          type: 'function',
          function: {
            name: 'test-tool',
            description: 'A test tool',
            parameters: {
              type: 'object',
              properties: {
                input: { type: 'string' }
              },
              required: ['input']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'tool-2',
            description: 'Second tool',
            parameters: {
              type: 'object',
              properties: {
                value: { type: 'number' }
              }
            }
          }
        }
      ]);
    });

    it('should handle empty tool list', () => {
      const formatted = registry.toOpenAIFormat([]);

      expect(formatted).toEqual([]);
    });
  });
});
