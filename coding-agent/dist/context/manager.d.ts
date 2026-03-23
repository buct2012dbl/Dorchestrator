import type { Session, ContextFile } from '../core/session.js';
import type { CodebaseIndexer } from './indexer.js';
export declare enum Priority {
    P0 = 0,// Current file being edited + immediate dependencies
    P1 = 1,// Recently accessed files (last 5 minutes)
    P2 = 2,// Related files (imports, exports, references)
    P3 = 3,// Dependencies of P0-P2 files
    P4 = 4
}
export declare class ContextManager {
    private cache;
    private indexer;
    private workingDirectory;
    constructor(workingDirectory: string, indexer?: CodebaseIndexer);
    buildContext(session: Session, task: string, budget: number): Promise<ContextFile[]>;
    private selectRelevantFiles;
    addFile(path: string, priority: Priority): Promise<void>;
    private readFile;
    private isStale;
    private getRecentFiles;
    private extractFilePaths;
    private getStructureFiles;
    private truncateToFit;
    private hash;
    getTokenCount(): number;
    clear(): void;
}
//# sourceMappingURL=manager.d.ts.map