import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Session, ContextFile } from '../core/session.js';
import type { CodebaseIndexer } from './indexer.js';
import { tokenCounter } from '../llm/token-counter.js';
import { createHash } from 'node:crypto';

export enum Priority {
  P0 = 0, // Current file being edited + immediate dependencies
  P1 = 1, // Recently accessed files (last 5 minutes)
  P2 = 2, // Related files (imports, exports, references)
  P3 = 3, // Dependencies of P0-P2 files
  P4 = 4  // Project structure overview
}

interface CachedFile {
  content: string;
  tokens: number;
  priority: Priority;
  accessedAt: number;
  hash: string;
}

export class ContextManager {
  private cache = new Map<string, CachedFile>();
  private indexer: CodebaseIndexer | null = null;
  private workingDirectory: string;

  constructor(workingDirectory: string, indexer?: CodebaseIndexer) {
    this.workingDirectory = workingDirectory;
    this.indexer = indexer || null;
  }

  async buildContext(session: Session, task: string, budget: number): Promise<ContextFile[]> {
    const allocated = {
      systemPrompt: 0,
      task: 0,
      files: 0,
      history: 0,
      tools: 0
    };

    // Reserve space for system prompt and tools (estimated)
    allocated.systemPrompt = 5000;
    allocated.tools = 2000;
    allocated.task = tokenCounter.estimateTokens(task);

    const remaining = budget - allocated.systemPrompt - allocated.tools - allocated.task;

    // Allocate remaining budget (75% for files)
    const filesBudget = Math.floor(remaining * 0.75);

    // Select relevant files with priority ranking
    const relevantFiles = await this.selectRelevantFiles(task, session, filesBudget);

    return relevantFiles;
  }

  private async selectRelevantFiles(
    task: string,
    session: Session,
    budget: number
  ): Promise<ContextFile[]> {
    const candidates: Array<{ file: string; priority: Priority; tokens: number }> = [];

    // Priority 0: Files explicitly mentioned in task
    const mentionedFiles = this.extractFilePaths(task);
    for (const file of mentionedFiles) {
      try {
        const content = await this.readFile(file);
        candidates.push({
          file,
          priority: Priority.P0,
          tokens: tokenCounter.estimateTokens(content)
        });
      } catch {
        // File doesn't exist, skip
      }
    }

    // Priority 1: Recently accessed files (last 5 minutes)
    const recentFiles = this.getRecentFiles(session, 300000);
    for (const file of recentFiles) {
      if (!candidates.find(c => c.file === file)) {
        try {
          const content = await this.readFile(file);
          candidates.push({
            file,
            priority: Priority.P1,
            tokens: tokenCounter.estimateTokens(content)
          });
        } catch {
          // Skip
        }
      }
    }

    // Priority 2: Semantically relevant files from index
    if (this.indexer) {
      try {
        const searchResults = await this.indexer.search(task, { limit: 20 });
        for (const result of searchResults) {
          if (!candidates.find(c => c.file === result.path)) {
            try {
              const content = await this.readFile(result.path);
              candidates.push({
                file: result.path,
                priority: Priority.P2,
                tokens: tokenCounter.estimateTokens(content)
              });
            } catch {
              // Skip
            }
          }
        }
      } catch {
        // Index not available
      }
    }

    // Priority 3: Dependencies of P0-P2 files
    if (this.indexer) {
      const dependencies = new Set<string>();
      for (const candidate of candidates.filter(c => c.priority <= Priority.P2)) {
        try {
          const deps = await this.indexer.getDependencies(candidate.file, 1);
          deps.files.forEach(dep => dependencies.add(dep));
        } catch {
          // Skip
        }
      }

      for (const dep of dependencies) {
        if (!candidates.find(c => c.file === dep)) {
          try {
            const content = await this.readFile(dep);
            candidates.push({
              file: dep,
              priority: Priority.P3,
              tokens: tokenCounter.estimateTokens(content)
            });
          } catch {
            // Skip
          }
        }
      }
    }

    // Priority 4: Project structure files
    const structureFiles = await this.getStructureFiles();
    for (const file of structureFiles) {
      if (!candidates.find(c => c.file === file)) {
        try {
          const content = await this.readFile(file);
          candidates.push({
            file,
            priority: Priority.P4,
            tokens: tokenCounter.estimateTokens(content)
          });
        } catch {
          // Skip
        }
      }
    }

    // Sort by priority, then by tokens (prefer larger files within same priority)
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.tokens - a.tokens;
    });

    // Pack files into budget using greedy algorithm
    const selected: ContextFile[] = [];
    let usedTokens = 0;

    for (const candidate of candidates) {
      if (usedTokens + candidate.tokens <= budget) {
        const content = await this.readFile(candidate.file);
        selected.push({
          path: candidate.file,
          content,
          priority: candidate.priority,
          tokens: candidate.tokens
        });
        usedTokens += candidate.tokens;
      } else if (candidate.priority === Priority.P0) {
        // P0 files must be included, truncate if necessary
        const content = await this.readFile(candidate.file);
        const truncated = this.truncateToFit(content, budget - usedTokens);
        selected.push({
          path: candidate.file,
          content: truncated,
          priority: candidate.priority,
          tokens: budget - usedTokens,
          truncated: true
        });
        break;
      }
    }

    return selected;
  }

  async addFile(path: string, priority: Priority): Promise<void> {
    const content = await this.readFile(path);
    const tokens = tokenCounter.estimateTokens(content);

    this.cache.set(path, {
      content,
      tokens,
      priority,
      accessedAt: Date.now(),
      hash: this.hash(content)
    });
  }

  private async readFile(path: string): Promise<string> {
    const cached = this.cache.get(path);
    if (cached && !this.isStale(cached)) {
      return cached.content;
    }

    const fullPath = resolve(this.workingDirectory, path);
    const content = await readFile(fullPath, 'utf-8');
    const tokens = tokenCounter.estimateTokens(content);

    this.cache.set(path, {
      content,
      tokens,
      priority: Priority.P2,
      accessedAt: Date.now(),
      hash: this.hash(content)
    });

    return content;
  }

  private isStale(cached: CachedFile): boolean {
    const maxAge = 60000; // 1 minute
    return Date.now() - cached.accessedAt > maxAge;
  }

  private getRecentFiles(session: Session, maxAge: number): string[] {
    const cutoff = Date.now() - maxAge;
    const files = new Set<string>();

    for (const message of session.messages) {
      if (message.timestamp < cutoff) continue;

      // Extract file paths from tool calls
      if (message.role === 'assistant' && message.toolCalls) {
        for (const toolCall of message.toolCalls) {
          if (toolCall.name === 'read' || toolCall.name === 'write' || toolCall.name === 'edit') {
            try {
              const args = JSON.parse(toolCall.arguments);
              if (args.file_path) {
                files.add(args.file_path);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    }

    return Array.from(files);
  }

  private extractFilePaths(text: string): string[] {
    const patterns = [
      /(?:^|\s)([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)(?:\s|$)/g,
      /`([^`]+\.[a-zA-Z0-9]+)`/g,
      /"([^"]+\.[a-zA-Z0-9]+)"/g,
    ];

    const files = new Set<string>();
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        files.add(match[1]);
      }
    }

    return Array.from(files);
  }

  private async getStructureFiles(): Promise<string[]> {
    const candidates = [
      'package.json',
      'tsconfig.json',
      'README.md',
      'pyproject.toml',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'build.gradle'
    ];

    const existing: string[] = [];
    for (const file of candidates) {
      try {
        await this.readFile(file);
        existing.push(file);
      } catch {
        // File doesn't exist
      }
    }

    return existing;
  }

  private truncateToFit(content: string, budget: number): string {
    const lines = content.split('\n');
    let truncated = '';
    let tokens = 0;

    for (const line of lines) {
      const lineTokens = tokenCounter.estimateTokens(line + '\n');
      if (tokens + lineTokens > budget) break;
      truncated += line + '\n';
      tokens += lineTokens;
    }

    return truncated + '\n... [truncated]';
  }

  private hash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  getTokenCount(): number {
    let total = 0;
    for (const cached of this.cache.values()) {
      total += cached.tokens;
    }
    return total;
  }

  clear(): void {
    this.cache.clear();
  }
}
