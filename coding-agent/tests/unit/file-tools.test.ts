import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { editTool, grepTool, readTool, writeTool } from '../../src/tools/file-tools.js';
import type { ToolContext } from '../../src/tools/tool-registry.js';

describe('file-tools workspace boundaries', () => {
  let workspaceDir: string;
  let outsideDir: string;
  let context: ToolContext;

  beforeEach(async () => {
    workspaceDir = await mkdtemp(join(tmpdir(), 'file-tools-workspace-'));
    outsideDir = await mkdtemp(join(tmpdir(), 'file-tools-outside-'));
    context = {
      sessionId: 'test-session',
      agentId: 'test-agent',
      workingDirectory: workspaceDir
    };

    await writeFile(join(workspaceDir, 'inside.txt'), 'inside', 'utf-8');
    await writeFile(join(outsideDir, 'outside.txt'), 'outside', 'utf-8');
  });

  afterEach(async () => {
    await rm(workspaceDir, { recursive: true, force: true });
    await rm(outsideDir, { recursive: true, force: true });
  });

  it('allows reading a file inside the workspace', async () => {
    const result = await readTool.execute({ file_path: './inside.txt' }, context);

    expect(result).toEqual({
      success: true,
      data: { content: 'inside', path: './inside.txt' }
    });
  });

  it('rejects reading a file outside the workspace', async () => {
    const result = await readTool.execute({ file_path: '../outside.txt' }, context);

    expect(result).toEqual({
      success: false,
      error: 'Access denied: path must stay within the working directory'
    });
  });

  it('rejects writing a file outside the workspace', async () => {
    const result = await writeTool.execute({ file_path: '../outside.txt', content: 'changed' }, context);

    expect(result).toEqual({
      success: false,
      error: 'Access denied: path must stay within the working directory'
    });
  });

  it('rejects editing a file outside the workspace', async () => {
    const result = await editTool.execute(
      { file_path: '../outside.txt', old_string: 'outside', new_string: 'changed' },
      context
    );

    expect(result).toEqual({
      success: false,
      error: 'Access denied: path must stay within the working directory'
    });
  });

  it('allows editing a file inside the workspace', async () => {
    const result = await editTool.execute(
      { file_path: 'inside.txt', old_string: 'inside', new_string: 'updated' },
      context
    );

    expect(result).toEqual({
      success: true,
      data: { path: 'inside.txt', replaced: true }
    });
    await expect(readFile(join(workspaceDir, 'inside.txt'), 'utf-8')).resolves.toBe('updated');
  });

  it('allows grep to search inside the workspace', async () => {
    const result = await grepTool.execute({ pattern: 'inside', path: '.' }, context);

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      count: 1
    });
    expect(result.data?.matches).toEqual(expect.arrayContaining(['./inside.txt:1:inside']));
  });

  it('rejects grep paths outside the workspace', async () => {
    const result = await grepTool.execute({ pattern: 'outside', path: '../' }, context);

    expect(result).toEqual({
      success: false,
      error: 'Access denied: path must stay within the working directory'
    });
  });

  it('treats shell metacharacters in grep arguments as literal input', async () => {
    const sentinelPath = join(workspaceDir, 'sentinel.txt');
    const result = await grepTool.execute(
      {
        pattern: 'inside" && touch sentinel.txt && echo "',
        path: '.',
        file_pattern: '*.txt" && touch sentinel.txt && echo "'
      },
      context
    );

    expect(result).toEqual({
      success: true,
      data: { matches: [], count: 0 }
    });
    await expect(readFile(sentinelPath, 'utf-8')).rejects.toThrow();
  });
});
