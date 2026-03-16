-- File metadata
CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT UNIQUE NOT NULL,
  hash TEXT NOT NULL,
  size INTEGER,
  language TEXT,
  modified_at INTEGER,
  indexed_at INTEGER,
  line_count INTEGER,
  token_count INTEGER
);

-- Symbol table (functions, classes, variables, etc.)
CREATE TABLE IF NOT EXISTS symbols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  signature TEXT,
  docstring TEXT,
  scope TEXT,
  visibility TEXT,
  UNIQUE(file_id, name, line_start)
);

-- Dependencies (import/export relationships)
CREATE TABLE IF NOT EXISTS dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  target_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  import_type TEXT,
  imported_symbols TEXT,
  line_number INTEGER,
  UNIQUE(source_file_id, target_file_id, line_number)
);

-- Symbol references (where symbols are used)
CREATE TABLE IF NOT EXISTS references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  line_number INTEGER,
  context TEXT
);

-- Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS file_content_fts USING fts5(
  file_id UNINDEXED,
  content
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(type);
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_source ON dependencies(source_file_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_target ON dependencies(target_file_id);
CREATE INDEX IF NOT EXISTS idx_references_symbol ON references(symbol_id);
CREATE INDEX IF NOT EXISTS idx_references_file ON references(file_id);
CREATE INDEX IF NOT EXISTS idx_files_language ON files(language);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
