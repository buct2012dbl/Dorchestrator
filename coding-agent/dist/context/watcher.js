import { watch } from 'chokidar';
export class IndexWatcher {
    watcher = null;
    indexer;
    debounceMap = new Map();
    debounceDelay = 500;
    constructor(indexer) {
        this.indexer = indexer;
    }
    start(rootPath) {
        this.watcher = watch(rootPath, {
            ignored: [
                /(^|[\/\\])\../,
                '**/node_modules/**',
                '**/.git/**',
                '**/dist/**',
                '**/build/**',
                '**/.next/**',
                '**/coverage/**'
            ],
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 300,
                pollInterval: 100
            }
        });
        this.watcher
            .on('add', path => this.scheduleUpdate(path))
            .on('change', path => this.scheduleUpdate(path))
            .on('unlink', path => this.handleDelete(path));
        console.log(`Index watcher started for ${rootPath}`);
    }
    stop() {
        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }
        // Clear all pending debounces
        for (const timeout of this.debounceMap.values()) {
            clearTimeout(timeout);
        }
        this.debounceMap.clear();
        console.log('Index watcher stopped');
    }
    scheduleUpdate(path) {
        // Clear existing timeout
        const existing = this.debounceMap.get(path);
        if (existing) {
            clearTimeout(existing);
        }
        // Schedule new update
        const timeout = setTimeout(async () => {
            try {
                await this.indexer.updateFile(path);
                console.log(`Updated index for ${path}`);
            }
            catch (error) {
                console.error(`Failed to update index for ${path}:`, error);
            }
            finally {
                this.debounceMap.delete(path);
            }
        }, this.debounceDelay);
        this.debounceMap.set(path, timeout);
    }
    async handleDelete(path) {
        try {
            await this.indexer.deleteFile(path);
            console.log(`Removed ${path} from index`);
        }
        catch (error) {
            console.error(`Failed to remove ${path} from index:`, error);
        }
    }
}
//# sourceMappingURL=watcher.js.map