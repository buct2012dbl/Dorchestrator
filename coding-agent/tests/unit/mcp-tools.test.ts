import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tool } from '../../src/tools/tool-registry.js';

const mockReadFile = vi.fn();
const mockSpawn = vi.fn();

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

vi.mock('node:child_process', () => ({
  spawn: mockSpawn,
}));

function createMockChild(toolNames: string[]) {
  let stdoutHandler: ((chunk: string) => void) | null = null;
  let exitHandler: ((code: number | null, signal: NodeJS.Signals | null) => void) | null = null;
  let requestCount = 0;

  return {
    stdin: {
      write(payload: string, callback?: (error?: Error | null) => void) {
        const message = JSON.parse(payload.trim());
        if (message.method === 'initialize') {
          stdoutHandler?.(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {},
          }) + '\n');
        } else if (message.method === 'tools/list') {
          const toolName = toolNames[requestCount++] ?? toolNames[toolNames.length - 1];
          stdoutHandler?.(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              tools: [{
                name: toolName,
                description: `${toolName} description`,
                inputSchema: {
                  type: 'object',
                  properties: {},
                },
              }],
            },
          }) + '\n');
        } else if (message.method === 'notifications/initialized') {
          // no-op
        }
        callback?.(null);
        return true;
      },
    },
    stdout: {
      setEncoding: vi.fn(),
      on(event: string, handler: (chunk: string) => void) {
        if (event === 'data') {
          stdoutHandler = handler;
        }
      },
    },
    stderr: {
      setEncoding: vi.fn(),
      on: vi.fn(),
    },
    on(event: string, handler: (code: number | null, signal: NodeJS.Signals | null) => void) {
      if (event === 'exit') {
        exitHandler = handler;
      }
    },
    kill: vi.fn(() => {
      exitHandler?.(null, 'SIGTERM');
    }),
  };
}

describe('registerMcpToolsFromEnvironment', () => {
  const originalEnv = process.env.CODING_AGENT_MCP_CONFIG;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.CODING_AGENT_MCP_CONFIG;
    } else {
      process.env.CODING_AGENT_MCP_CONFIG = originalEnv;
    }
  });

  it('namespaces local MCP tool ids by server name to avoid collisions', async () => {
    process.env.CODING_AGENT_MCP_CONFIG = '/tmp/mcp-config.json';
    mockReadFile.mockResolvedValue(JSON.stringify({
      mcpServers: {
        alpha: { command: 'alpha-server' },
        beta: { command: 'beta-server' },
      },
    }));

    mockSpawn
      .mockReturnValueOnce(createMockChild(['search']))
      .mockReturnValueOnce(createMockChild(['search']));

    const { registerMcpToolsFromEnvironment } = await import('../../src/tools/mcp-tools.js');
    const tools: Tool[] = [];

    const registeredIds = await registerMcpToolsFromEnvironment((tool) => {
      tools.push(tool);
    });

    expect(registeredIds).toEqual(['mcp:alpha:search', 'mcp:beta:search']);
    expect(tools.map((tool) => tool.id)).toEqual(['mcp:alpha:search', 'mcp:beta:search']);
    expect(tools[0]?.description).toContain('search description');
    expect(tools[1]?.description).toContain('search description');
  });
});
