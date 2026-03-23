import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class CodebaseDatabase {
    db;
    constructor(dbPath) {
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
        this.initialize();
    }
    initialize() {
        const schemaPath = resolve(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
    }
    // File operations
    insertFile(file) {
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
        const result = stmt.run(file.path, file.hash, file.size, file.language, file.modified_at, file.indexed_at, file.line_count, file.token_count);
        return result.lastInsertRowid;
    }
    getFile(path) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
        return stmt.get(path);
    }
    getFileById(id) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
        return stmt.get(id);
    }
    deleteFile(path) {
        const stmt = this.db.prepare('DELETE FROM files WHERE path = ?');
        stmt.run(path);
    }
    getAllFiles() {
        const stmt = this.db.prepare('SELECT * FROM files ORDER BY path');
        return stmt.all();
    }
    // Symbol operations
    insertSymbol(symbol) {
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
        const result = stmt.run(symbol.file_id, symbol.name, symbol.type, symbol.line_start, symbol.line_end, symbol.signature, symbol.docstring, symbol.scope, symbol.visibility);
        return result.lastInsertRowid;
    }
    getSymbolsByFile(fileId) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE file_id = ? ORDER BY line_start');
        return stmt.all(fileId);
    }
    findSymbolsByName(name) {
        const stmt = this.db.prepare('SELECT * FROM symbols WHERE name LIKE ? ORDER BY name');
        return stmt.all(`%${name}%`);
    }
    deleteSymbolsByFile(fileId) {
        const stmt = this.db.prepare('DELETE FROM symbols WHERE file_id = ?');
        stmt.run(fileId);
    }
    // Dependency operations
    insertDependency(dep) {
        const stmt = this.db.prepare(`
      INSERT INTO dependencies (source_file_id, target_file_id, import_type, imported_symbols, line_number)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(source_file_id, target_file_id, line_number) DO UPDATE SET
        import_type = excluded.import_type,
        imported_symbols = excluded.imported_symbols
    `);
        const result = stmt.run(dep.source_file_id, dep.target_file_id, dep.import_type, dep.imported_symbols, dep.line_number);
        return result.lastInsertRowid;
    }
    getDependencies(fileId) {
        const stmt = this.db.prepare('SELECT * FROM dependencies WHERE source_file_id = ?');
        return stmt.all(fileId);
    }
    getReverseDependencies(fileId) {
        const stmt = this.db.prepare('SELECT * FROM dependencies WHERE target_file_id = ?');
        return stmt.all(fileId);
    }
    deleteDependenciesByFile(fileId) {
        const stmt = this.db.prepare('DELETE FROM dependencies WHERE source_file_id = ?');
        stmt.run(fileId);
    }
    // Full-text search
    insertFileContent(fileId, content) {
        const stmt = this.db.prepare('INSERT INTO file_content_fts (file_id, content) VALUES (?, ?)');
        stmt.run(fileId, content);
    }
    searchContent(query, limit = 50) {
        const stmt = this.db.prepare(`
      SELECT file_id, content FROM file_content_fts
      WHERE content MATCH ?
      LIMIT ?
    `);
        return stmt.all(query, limit);
    }
    deleteFileContent(fileId) {
        const stmt = this.db.prepare('DELETE FROM file_content_fts WHERE file_id = ?');
        stmt.run(fileId);
    }
    // Statistics
    getStats() {
        const fileCount = this.db.prepare('SELECT COUNT(*) as count FROM files').get();
        const symbolCount = this.db.prepare('SELECT COUNT(*) as count FROM symbols').get();
        const depCount = this.db.prepare('SELECT COUNT(*) as count FROM dependencies').get();
        const langStats = this.db.prepare(`
      SELECT language, COUNT(*) as count
      FROM files
      GROUP BY language
      ORDER BY count DESC
    `).all();
        return {
            files: fileCount.count,
            symbols: symbolCount.count,
            dependencies: depCount.count,
            byLanguage: langStats
        };
    }
    close() {
        this.db.close();
    }
    // Transaction support
    transaction(fn) {
        return this.db.transaction(fn)();
    }
}
//# sourceMappingURL=database.js.map