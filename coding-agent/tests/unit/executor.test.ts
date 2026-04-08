import { describe, it, expect, vi, afterEach } from 'vitest';
import { ParallelExecutor } from '../../src/core/executor.js';

describe('ParallelExecutor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps Promise.race limited to active tasks', async () => {
    const executor = new ParallelExecutor(2);
    const raceSizes: number[] = [];
    const originalRace = Promise.race;
    const releases = Array.from({ length: 5 }, () => Promise.withResolvers<void>());

    const raceSpy = vi
      .spyOn(Promise, 'race')
      .mockImplementation(function <T>(values: Iterable<T | PromiseLike<T>>) {
        raceSizes.push(Array.from(values).length);
        return originalRace.call(this, values);
      });

    const execution = executor.execute(
      releases.map((release, index) => ({
        id: `task-${index}`,
        priority: 10 - index,
        createdAt: index,
        fn: async () => {
          await release.promise;
          return index;
        }
      }))
    );

    await Promise.resolve();

    for (const release of releases) {
      release.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    const results = await execution;

    expect(results.map(result => result.result)).toEqual([0, 1, 2, 3, 4]);
    expect(raceSpy).toHaveBeenCalled();
    expect(raceSizes.every(size => size <= 2)).toBe(true);
  });
});
