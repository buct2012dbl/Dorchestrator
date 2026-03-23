import type { CodebaseIndexer } from './indexer.js';
export declare class IndexWatcher {
    private watcher;
    private indexer;
    private debounceMap;
    private debounceDelay;
    constructor(indexer: CodebaseIndexer);
    start(rootPath: string): void;
    stop(): void;
    private scheduleUpdate;
    private handleDelete;
}
//# sourceMappingURL=watcher.d.ts.map