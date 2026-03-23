import { type SymbolRecord } from './database.js';
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
export declare class CodebaseIndexer {
    private db;
    private rootPath;
    constructor(dbPath: string, rootPath: string);
    buildIndex(options?: IndexOptions): Promise<IndexStats>;
    search(query: string, options?: {
        limit?: number;
    }): Promise<SearchResult[]>;
    findRelevant(query: string, limit: number): Promise<string[]>;
    getDependencies(filePath: string, depth?: number): Promise<{
        files: string[];
    }>;
    getReverseDependencies(filePath: string): Promise<string[]>;
    findSymbol(name: string): Promise<Array<{
        file: string;
        line: number;
        type: string;
    }>>;
    getFileSymbols(filePath: string): Promise<SymbolRecord[]>;
    updateFile(filePath: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    getStats(): IndexStats;
    close(): void;
    private detectLanguage;
    private hashContent;
    private extractSymbols;
    private extractDependencies;
    private resolveImportPath;
}
//# sourceMappingURL=indexer.d.ts.map