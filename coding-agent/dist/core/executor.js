export class ParallelExecutor {
    maxConcurrent;
    running = 0;
    queue = [];
    results = new Map();
    constructor(maxConcurrent = 5) {
        this.maxConcurrent = maxConcurrent;
    }
    async execute(tasks) {
        // Add tasks to queue
        this.queue.push(...tasks);
        // Sort by priority (higher first)
        this.queue.sort((a, b) => b.priority - a.priority);
        // Execute tasks
        const activeTasks = new Set();
        while (this.queue.length > 0 || this.running > 0) {
            while (this.running < this.maxConcurrent && this.queue.length > 0) {
                const task = this.queue.shift();
                let taskPromise;
                taskPromise = this.executeTask(task).finally(() => {
                    activeTasks.delete(taskPromise);
                });
                activeTasks.add(taskPromise);
            }
            // Wait for at least one task to complete
            if (activeTasks.size > 0) {
                await Promise.race(activeTasks);
            }
        }
        // Return results in original order
        return tasks.map(task => this.results.get(task.id));
    }
    async executeTask(task) {
        this.running++;
        const startTime = Date.now();
        try {
            const result = await task.fn();
            this.results.set(task.id, {
                id: task.id,
                success: true,
                result,
                duration: Date.now() - startTime
            });
        }
        catch (error) {
            this.results.set(task.id, {
                id: task.id,
                success: false,
                error: error,
                duration: Date.now() - startTime
            });
        }
        finally {
            this.running--;
        }
    }
    getStats() {
        const results = Array.from(this.results.values());
        return {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            avgDuration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
            running: this.running,
            queued: this.queue.length
        };
    }
    clear() {
        this.queue = [];
        this.results.clear();
        this.running = 0;
    }
}
//# sourceMappingURL=executor.js.map