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
export declare class CodebaseDatabase {
    private db;
    constructor(dbPath: string);
    private initialize;
    insertFile(file: FileRecord): number;
    getFile(path: string): FileRecord | undefined;
    getFileById(id: number): FileRecord | undefined;
    deleteFile(path: string): void;
    getAllFiles(): FileRecord[];
    insertSymbol(symbol: SymbolRecord): number;
    getSymbolsByFile(fileId: number): SymbolRecord[];
    findSymbolsByName(name: string): SymbolRecord[];
    deleteSymbolsByFile(fileId: number): void;
    insertDependency(dep: DependencyRecord): number;
    getDependencies(fileId: number): DependencyRecord[];
    getReverseDependencies(fileId: number): DependencyRecord[];
    deleteDependenciesByFile(fileId: number): void;
    insertFileContent(fileId: number, content: string): void;
    searchContent(query: string, limit?: number): Array<{
        file_id: number;
        content: string;
    }>;
    deleteFileContent(fileId: number): void;
    getStats(): {
        files: number;
        symbols: number;
        dependencies: number;
        byLanguage: {
            language: string;
            count: number;
        }[];
    };
    close(): void;
    transaction<T>(fn: () => T): T;
}
//# sourceMappingURL=database.d.ts.map