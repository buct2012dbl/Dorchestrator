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

export class ParallelExecutor {
  private maxConcurrent: number;
  private running = 0;
  private queue: Task[] = [];
  private results = new Map<string, TaskResult>();

  constructor(maxConcurrent: number = 5) {
    this.maxConcurrent = maxConcurrent;
  }

  async execute<T>(tasks: Task<T>[]): Promise<TaskResult<T>[]> {
    // Add tasks to queue
    this.queue.push(...tasks);

    // Sort by priority (higher first)
    this.queue.sort((a, b) => b.priority - a.priority);

    // Execute tasks
    const activeTasks = new Set<Promise<void>>();

    while (this.queue.length > 0 || this.running > 0) {
      while (this.running < this.maxConcurrent && this.queue.length > 0) {
        const task = this.queue.shift()!;
        let taskPromise!: Promise<void>;
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
    return tasks.map(task => this.results.get(task.id)!);
  }

  private async executeTask<T>(task: Task<T>): Promise<void> {
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
    } catch (error) {
      this.results.set(task.id, {
        id: task.id,
        success: false,
        error: error as Error,
        duration: Date.now() - startTime
      });
    } finally {
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

  clear(): void {
    this.queue = [];
    this.results.clear();
    this.running = 0;
  }
}
