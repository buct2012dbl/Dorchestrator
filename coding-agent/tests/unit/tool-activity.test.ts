import { describe, expect, it } from 'vitest';
import {
  createCompletedToolEvent,
  createFailedToolEvent,
  createQueuedToolEvent,
  createRunningToolEvent,
  summarizeToolCall,
  summarizeToolResult,
} from '../../src/agent/tool-activity.js';

describe('tool activity summaries', () => {
  it('summarizes bash commands concisely', () => {
    expect(summarizeToolCall('bash', { command: 'npm test -- --runInBand' })).toBe(
      'Run shell command: npm test -- --runInBand'
    );
  });

  it('summarizes edits with path and replacement context', () => {
    expect(summarizeToolCall('edit', {
      file_path: 'src/app.js',
      old_string: 'foo()',
      new_string: 'bar()',
    })).toBe('Edit src/app.js: replace foo() with bar()');
  });

  it('falls back to compact key/value summaries for unknown tools', () => {
    expect(summarizeToolCall('custom_tool', { target: 'README.md', line: 12 })).toBe(
      'custom_tool (target: README.md, line: 12)'
    );
  });

  it('summarizes tool results and errors', () => {
    expect(summarizeToolResult({ success: true, data: 'Completed successfully' })).toBe(
      'Completed successfully'
    );
    expect(summarizeToolResult({ success: false, error: 'Permission denied' })).toBe(
      'Error: Permission denied'
    );
  });

  it('builds lifecycle events with tool metadata', () => {
    const queued = createQueuedToolEvent('read', { file_path: 'README.md' });
    const running = createRunningToolEvent('bash', { command: 'npm test' });
    const completed = createCompletedToolEvent('write', { success: true, data: { bytes: 42 } });
    const failed = createFailedToolEvent('edit', new Error('No match found'));

    expect(queued).toMatchObject({
      kind: 'tool',
      phase: 'running',
      toolName: 'read',
      toolState: 'queued',
      text: 'Read README.md',
    });
    expect(running).toMatchObject({
      toolName: 'bash',
      toolState: 'running',
      text: 'Run shell command: npm test',
    });
    expect(completed).toMatchObject({
      toolName: 'write',
      toolState: 'completed',
      text: '{"bytes":42}',
    });
    expect(failed).toMatchObject({
      toolName: 'edit',
      toolState: 'failed',
      text: 'Error: No match found',
    });
  });
});
