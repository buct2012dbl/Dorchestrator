import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface FileRecord {
  id?: number;
  path: string;
  hash: string;
  size: number;
  language: string;
  modified_at: number;
  indexed_at: number;
  line_count: number;
  token_count: number;
}

export interface SymbolRecord {
  id?: number;
  file_id: number;
  name: string;
  type: string;
  line_start: number;
  line_end: number;
  signature?: string;
  docstring?: string;
  scope?: string;
  visibility?: string;
}

export interface DependencyRecord {
  id?: number;
  source_file_id: number;
  target_file_id: number;
  import_type?: string;
  imported_symbols?: string;
  line_number: number;
}

export interface ReferenceRecord {
  id?: number;
  symbol_id: number;
  file_id: number;
  line_number: number;
  context?: string;
}

export class CodebaseDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initialize();
  }

  private initialize(): void {
    const schemaPath = resolve(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
  }

  // File operations
  insertFile(file: FileRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, hash, size, language, modified_at, indexed_at, line_count, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        hash = excluded.hash,
        size = excluded.size,
        language = excluded.language,
        modified_at = excluded.modified_at,
        indexed_at = excluded.indexed_at,
        line_count = excluded.line_count,
        token_count = excluded.token_count
    `);

    const result = stmt.run(
      file.path,
      file.hash,
      file.size,
      file.language,
      file.modified_at,
      file.indexed_at,
      file.line_count,
      file.token_count
    );

    return result.lastInsertRowid as number;
  }

  getFile(path: string): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
    return stmt.get(path) as FileRecord | undefined;
  }

  getFileById(id: number): FileRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
    return stmt.get(id) as FileRecord | undefined;
  }

  deleteFile(path: string): void {
    const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
    stmt.run(path);
  }

  getAllFiles(): FileRecord[] {
    const stmt = this.db.prepare('SELECT * FROM files ORDER BY path');
    return stmt.all() as FileRecord[];
  }

  // Symbol operations
  insertSymbol(symbol: SymbolRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO symbols (file_id, name, type, line_start, line_end, signature, docstring, scope, visibility)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(file_id, name, line_start) DO UPDATE SET
        type = excluded.type,
        line_end = excluded.line_end,
        signature = excluded.signature,
        docstring = excluded.docstring,
        scope = excluded.scope,
        visibility = excluded.visibility
    `);

    const result = stmt.run(
      symbol.file_id,
      symbol.name,
      symbol.type,
      symbol.line_start,
      symbol.line_end,
      symbol.signature,
      symbol.docstring,
      symbol.scope,
      symbol.visibility
    );

    return result.lastInsertRowid as number;
  }

  getSymbolsByFile(fileId: number): SymbolRecord[] {
    const stmt = this.db.prepare('SELECT * FROM symbols WHERE file_id = ? ORDER BY line_start');
    return stmt.all(fileId) as SymbolRecord[];
  }

  findSymbolsByName(name: string): SymbolRecord[] {
    const stmt = this.db.prepare('SELECT * FROM symbols WHERE name LIKE ? ORDER BY name');
    return stmt.all(`%${name}%`) as SymbolRecord[];
  }

  deleteSymbolsByFile(fileId: number): void {
    const stmt = this.db.prepare('DELETE FROM symbols WHERE file_id = ?');
    stmt.run(fileId);
  }

  // Dependency operations
  insertDependency(dep: DependencyRecord): number {
    const stmt = this.db.prepare(`
      INSERT INTO dependencies (source_file_id, target_file_id, import_type, imported_symbols, line_number)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_file_id, target_file_id, line_number) DO UPDATE SET
        import_type = excluded.import_type,
        imported_symbols = excluded.imported_symbols
    `);

    const result = stmt.run(
      dep.source_file_id,
      dep.target_file_id,
      dep.import_type,
      dep.imported_symbols,
      dep.line_number
    );

    return result.lastInsertRowid as number;
  }

  getDependencies(fileId: number): DependencyRecord[] {
    const stmt = this.db.prepare('SELECT * FROM dependencies WHERE source_file_id = ?');
    return stmt.all(fileId) as DependencyRecord[];
  }

  getReverseDependencies(fileId: number): DependencyRecord[] {
    const stmt = this.db.prepare('SELECT * FROM dependencies WHERE target_file_id = ?');
    return stmt.all(fileId) as DependencyRecord[];
  }

  deleteDependenciesByFile(fileId: number): void {
    const stmt = this.db.prepare('DELETE FROM dependencies WHERE source_file_id = ?');
    stmt.run(fileId);
  }

  // Full-text search
  insertFileContent(fileId: number, content: string): void {
    const stmt = this.db.prepare('INSERT INTO file_content_fts (file_id, content) VALUES (?, ?)');
    stmt.run(fileId, content);
  }

  searchContent(query: string, limit: number = 50): Array<{ file_id: number; content: string }> {
    const stmt = this.db.prepare(`
      SELECT file_id, content FROM file_content_fts
      WHERE content MATCH ?
      LIMIT ?
    `);
    return stmt.all(query, limit) as Array<{ file_id: number; content: string }>;
  }

  deleteFileContent(fileId: number): void {
    const stmt = this.db.prepare('DELETE FROM file_content_fts WHERE file_id = ?');
    stmt.run(fileId);
  }

  // Statistics
  getStats() {
    const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number };
    const symbolCount = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get() as { count: number };
    const depCount = this.db.prepare('SELECT COUNT(*) as count FROM dependencies').get() as { count: number };

    const langStats = this.db.prepare(`
      SELECT language, COUNT(*) as count
      FROM files
      GROUP BY language
      ORDER BY count DESC
    `).all() as Array<{ language: string; count: number }>;

    return {
      files: fileCount.count,
      symbols: symbolCount.count,
      dependencies: depCount.count,
      byLanguage: langStats
    };
  }

  close(): void {
    this.db.close();
  }

  // Transaction support
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
