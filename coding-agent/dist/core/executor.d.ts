export interface Task<T = any> {
    id: string;
    fn: () => Promise<T>;
    priority: number;
    agentId?: string;
    createdAt: number;
}
export interface TaskResult<T = any> {
    id: string;
    success: boolean;
    result?: T;
    error?: Error;
    duration: number;
}
export declare class ParallelExecutor {
    private maxConcurrent;
    private running;
    private queue;
    private results;
    constructor(maxConcurrent?: number);
    execute<T>(tasks: Task<T>[]): Promise<TaskResult<T>[]>;
    private executeTask;
    getStats(): {
        total: number;
        successful: number;
        failed: number;
        avgDuration: number;
        running: number;
        queued: number;
    };
    clear(): void;
}
//# sourceMappingURL=executor.d.ts.map