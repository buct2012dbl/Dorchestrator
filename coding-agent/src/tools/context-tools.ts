import type { Tool, ToolContext, ToolResult } from './tool-registry.js';
import { CodebaseIndexer } from '../context/indexer.js';
import { resolve } from 'node:path';

export const searchCodeTool: Tool = {
  id: 'search_code',
  description: 'Search for code patterns in the codebase using full-text search',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (supports keywords and phrases)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20)'
      }
    },
    required: ['query']
  },
  async execute(
    args: { query: string; limit?: number },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      const dbPath = resolve(context.workingDirectory, '.coding-agent/index.db');
      const indexer = new CodebaseIndexer(dbPath, context.workingDirectory);

      const results = await indexer.search(args.query, {
        limit: args.limit || 20
      });

      indexer.close();

      return {
        success: true,
        data: {
          results,
          count: results.length
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

export const getDependenciesTool: Tool = {
  id: 'get_dependencies',
  description: 'Get file dependencies (imports/requires)',
  parameters: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Path to the file'
      },
      depth: {
        type: 'number',
        description: 'Dependency depth (default: 1)'
      }
    },
    required: ['file_path']
  },
  async execute(
    args: { file_path: string; depth?: number },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      const dbPath = resolve(context.workingDirectory, '.coding-agent/index.db');
      const indexer = new CodebaseIndexer(dbPath, context.workingDirectory);

      const deps = await indexer.getDependencies(args.file_path, args.depth || 1);

      indexer.close();

      return {
        success: true,
        data: deps
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

export const findSymbolTool: Tool = {
  id: 'find_symbol',
  description: 'Find symbol definitions (functions, classes, variables)',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Symbol name to search for'
      }
    },
    required: ['name']
  },
  async execute(
    args: { name: string },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      const dbPath = resolve(context.workingDirectory, '.coding-agent/index.db');
      const indexer = new CodebaseIndexer(dbPath, context.workingDirectory);

      const symbols = await indexer.findSymbol(args.name);

      indexer.close();

      return {
        success: true,
        data: {
          symbols,
          count: symbols.length
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

export const indexCodebaseTool: Tool = {
  id: 'index_codebase',
  description: 'Build or rebuild the codebase index for fast searching',
  parameters: {
    type: 'object',
    properties: {
      incremental: {
        type: 'boolean',
        description: 'Only index changed files (default: false)'
      }
    }
  },
  async execute(
    args: { incremental?: boolean },
    context: ToolContext
  ): Promise<ToolResult> {
    try {
      const dbPath = resolve(context.workingDirectory, '.coding-agent/index.db');
      const indexer = new CodebaseIndexer(dbPath, context.workingDirectory);

      const stats = await indexer.buildIndex({
        incremental: args.incremental || false
      });

      indexer.close();

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};
