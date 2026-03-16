import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve } from 'node:path';
import glob from 'fast-glob';
import { CodebaseDatabase, type FileRecord, type SymbolRecord } from './database.js';
import { tokenCounter } from '../llm/token-counter.js';

export interface IndexOptions {
  incremental?: boolean;
  languages?: string[];
  excludePatterns?: string[];
}

export interface SearchResult {
  path: string;
  score: number;
  matches: string[];
}

export interface IndexStats {
  filesIndexed: number;
  symbolsFound: number;
  dependenciesFound: number;
  duration: number;
}

export class CodebaseIndexer {
  private db: CodebaseDatabase;
  private rootPath: string;

  constructor(dbPath: string, rootPath: string) {
    this.db = new CodebaseDatabase(dbPath);
    this.rootPath = rootPath;
  }

  async buildIndex(options: IndexOptions = {}): Promise<IndexStats> {
    const startTime = Date.now();
    const excludePatterns = options.excludePatterns || [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.min.js',
      '**/*.map'
    ];

    // Find all files
    const files = await glob('**/*', {
      cwd: this.rootPath,
      ignore: excludePatterns,
      onlyFiles: true,
      absolute: false
    });

    let filesIndexed = 0;
    let symbolsFound = 0;
    let dependenciesFound = 0;

    for (const filePath of files) {
      const language = this.detectLanguage(filePath);
      if (!language) continue;

      if (options.languages && !options.languages.includes(language)) {
        continue;
      }

      try {
        const fullPath = resolve(this.rootPath, filePath);
        const content = await readFile(fullPath, 'utf-8');
        const stats = await stat(fullPath);
        const hash = this.hashContent(content);

        // Check if file needs reindexing
        if (options.incremental) {
          const existing = this.db.getFile(filePath);
          if (existing && existing.hash === hash) {
            continue; // Skip unchanged files
          }
        }

        // Index file
        const fileRecord: FileRecord = {
          path: filePath,
          hash,
          size: stats.size,
          language,
          modified_at: stats.mtimeMs,
          indexed_at: Date.now(),
          line_count: content.split('\n').length,
          token_count: tokenCounter.estimateTokens(content)
        };

        const fileId = this.db.insertFile(fileRecord);

        // Delete old data
        this.db.deleteSymbolsByFile(fileId);
        this.db.deleteDependenciesByFile(fileId);
        this.db.deleteFileContent(fileId);

        // Extract symbols (basic implementation)
        const symbols = this.extractSymbols(content, language);
        for (const symbol of symbols) {
          this.db.insertSymbol({ ...symbol, file_id: fileId });
          symbolsFound++;
        }

        // Extract dependencies (basic implementation)
        const deps = this.extractDependencies(content, language, filePath);
        for (const dep of deps) {
          const targetFile = this.db.getFile(dep.targetPath);
          if (targetFile) {
            this.db.insertDependency({
              source_file_id: fileId,
              target_file_id: targetFile.id!,
              import_type: dep.type,
              imported_symbols: JSON.stringify(dep.symbols),
              line_number: dep.line
            });
            dependenciesFound++;
          }
        }

        // Index content for full-text search
        this.db.insertFileContent(fileId, content);

        filesIndexed++;
      } catch (error) {
        console.warn(`Failed to index ${filePath}:`, error);
      }
    }

    return {
      filesIndexed,
      symbolsFound,
      dependenciesFound,
      duration: Date.now() - startTime
    };
  }

  async search(query: string, options: { limit?: number } = {}): Promise<SearchResult[]> {
    const limit = options.limit || 20;
    const results = this.db.searchContent(query, limit);

    return results.map(result => {
      const file = this.db.getFileById(result.file_id);
      return {
        path: file?.path || '',
        score: 1.0,
        matches: [result.content.substring(0, 200)]
      };
    });
  }

  async findRelevant(query: string, limit: number): Promise<string[]> {
    const results = await this.search(query, { limit });
    return results.map(r => r.path);
  }

  async getDependencies(filePath: string, depth: number = 1): Promise<{ files: string[] }> {
    const file = this.db.getFile(filePath);
    if (!file) return { files: [] };

    const visited = new Set<number>();
    const result = new Set<string>();

    const traverse = (fileId: number, currentDepth: number) => {
      if (currentDepth > depth || visited.has(fileId)) return;
      visited.add(fileId);

      const deps = this.db.getDependencies(fileId);
      for (const dep of deps) {
        const targetFile = this.db.getFileById(dep.target_file_id);
        if (targetFile) {
          result.add(targetFile.path);
          traverse(dep.target_file_id, currentDepth + 1);
        }
      }
    };

    traverse(file.id!, 0);
    return { files: Array.from(result) };
  }

  async getReverseDependencies(filePath: string): Promise<string[]> {
    const file = this.db.getFile(filePath);
    if (!file) return [];

    const deps = this.db.getReverseDependencies(file.id!);
    return deps.map(dep => {
      const sourceFile = this.db.getFileById(dep.source_file_id);
      return sourceFile?.path || '';
    }).filter(Boolean);
  }

  async findSymbol(name: string): Promise<Array<{ file: string; line: number; type: string }>> {
    const symbols = this.db.findSymbolsByName(name);
    return symbols.map(symbol => {
      const file = this.db.getFileById(symbol.file_id);
      return {
        file: file?.path || '',
        line: symbol.line_start,
        type: symbol.type
      };
    });
  }

  async getFileSymbols(filePath: string): Promise<SymbolRecord[]> {
    const file = this.db.getFile(filePath);
    if (!file) return [];
    return this.db.getSymbolsByFile(file.id!);
  }

  async updateFile(filePath: string): Promise<void> {
    await this.buildIndex({
      incremental: true,
      excludePatterns: [filePath === filePath ? '!**' : '**']
    });
  }

  async deleteFile(filePath: string): Promise<void> {
    this.db.deleteFile(filePath);
  }

  getStats(): IndexStats {
    const stats = this.db.getStats();
    return {
      filesIndexed: stats.files,
      symbolsFound: stats.symbols,
      dependenciesFound: stats.dependencies,
      duration: 0
    };
  }

  close(): void {
    this.db.close();
  }

  private detectLanguage(filePath: string): string | null {
    const ext = extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.cs': 'csharp',
      '.scala': 'scala',
      '.ex': 'elixir',
      '.exs': 'elixir'
    };

    return langMap[ext] || null;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private extractSymbols(content: string, language: string): Omit<SymbolRecord, 'file_id'>[] {
    const symbols: Omit<SymbolRecord, 'file_id'>[] = [];
    const lines = content.split('\n');

    // Basic regex-based extraction (simplified)
    if (language === 'javascript' || language === 'typescript') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Functions
        const funcMatch = line.match(/(?:function|const|let|var)\s+(\w+)\s*[=\(]/);
        if (funcMatch) {
          symbols.push({
            name: funcMatch[1],
            type: 'function',
            line_start: i + 1,
            line_end: i + 1,
            scope: 'global',
            visibility: 'public'
          });
        }

        // Classes
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          symbols.push({
            name: classMatch[1],
            type: 'class',
            line_start: i + 1,
            line_end: i + 1,
            scope: 'global',
            visibility: 'public'
          });
        }
      }
    }

    return symbols;
  }

  private extractDependencies(
    content: string,
    language: string,
    filePath: string
  ): Array<{ targetPath: string; type: string; symbols: string[]; line: number }> {
    const deps: Array<{ targetPath: string; type: string; symbols: string[]; line: number }> = [];
    const lines = content.split('\n');

    if (language === 'javascript' || language === 'typescript') {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // ES6 imports
        const importMatch = line.match(/import\s+(?:{([^}]+)}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          const symbols = importMatch[1]
            ? importMatch[1].split(',').map(s => s.trim())
            : [importMatch[2]];

          deps.push({
            targetPath: this.resolveImportPath(importMatch[3], filePath),
            type: 'import',
            symbols,
            line: i + 1
          });
        }

        // Require
        const requireMatch = line.match(/require\(['"]([^'"]+)['"]\)/);
        if (requireMatch) {
          deps.push({
            targetPath: this.resolveImportPath(requireMatch[1], filePath),
            type: 'require',
            symbols: [],
            line: i + 1
          });
        }
      }
    }

    return deps;
  }

  private resolveImportPath(importPath: string, fromFile: string): string {
    // Simplified path resolution
    if (importPath.startsWith('.')) {
      const dir = fromFile.split('/').slice(0, -1).join('/');
      return resolve(dir, importPath).replace(this.rootPath + '/', '');
    }
    return importPath;
  }
}
