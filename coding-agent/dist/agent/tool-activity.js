const MAX_PREVIEW_LENGTH = 220;
function truncate(text, maxLength = MAX_PREVIEW_LENGTH) {
    const normalized = String(text || '').replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }
    return `${normalized.slice(0, maxLength - 1)}…`;
}
function formatScalar(value) {
    if (typeof value === 'string') {
        return truncate(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    if (value == null) {
        return '';
    }
    return truncate(JSON.stringify(value));
}
function formatPathAction(action, pathValue) {
    const pathText = formatScalar(pathValue);
    return pathText ? `${action} ${pathText}` : null;
}
function formatBashSummary(args) {
    const command = formatScalar(args.command || args.cmd || args.script);
    return command ? `Run shell command: ${command}` : 'Run shell command';
}
function formatEditSummary(args) {
    const pathText = formatScalar(args.file_path || args.path || args.file);
    const oldText = formatScalar(args.old_string || args.oldText || args.search);
    const newText = formatScalar(args.new_string || args.newText || args.replace);
    if (pathText && oldText && newText) {
        return `Edit ${pathText}: replace ${oldText} with ${newText}`;
    }
    if (pathText && oldText) {
        return `Edit ${pathText}: find ${oldText}`;
    }
    if (pathText) {
        return `Edit ${pathText}`;
    }
    return 'Edit file';
}
function formatWriteSummary(args) {
    const pathText = formatScalar(args.file_path || args.path || args.file);
    const content = typeof args.content === 'string' ? args.content : '';
    if (pathText && content) {
        return `Write ${pathText} (${content.length} chars)`;
    }
    return formatPathAction('Write', pathText) || 'Write file';
}
function formatReadSummary(args) {
    const pathText = formatScalar(args.file_path || args.path || args.file);
    const offset = args.offset;
    const limit = args.limit;
    const windowText = [
        Number.isFinite(offset) ? `offset ${offset}` : '',
        Number.isFinite(limit) ? `limit ${limit}` : '',
    ].filter(Boolean).join(', ');
    if (pathText && windowText) {
        return `Read ${pathText} (${windowText})`;
    }
    return formatPathAction('Read', pathText) || 'Read file';
}
function formatListSummary(args) {
    const pathText = formatScalar(args.path || args.dir || args.directory);
    return formatPathAction('List', pathText) || 'List directory';
}
function formatGrepSummary(args) {
    const pattern = formatScalar(args.pattern || args.query || args.search);
    const pathText = formatScalar(args.path || args.file_path || args.directory);
    if (pattern && pathText) {
        return `Search ${pathText} for ${pattern}`;
    }
    if (pattern) {
        return `Search for ${pattern}`;
    }
    return formatPathAction('Search', pathText) || 'Search files';
}
function formatSendMessageSummary(args) {
    const target = formatScalar(args.agent_id || args.target_agent_id || args.target);
    const message = formatScalar(args.message);
    if (target && message) {
        return `Send message to ${target}: ${message}`;
    }
    if (target) {
        return `Send message to ${target}`;
    }
    return 'Send message to agent';
}
function formatSpawnSummary(args) {
    const agentType = formatScalar(args.agent_type || args.type);
    const task = formatScalar(args.task || args.prompt);
    if (agentType && task) {
        return `Spawn ${agentType} subagent for ${task}`;
    }
    if (agentType) {
        return `Spawn ${agentType} subagent`;
    }
    return 'Spawn subagent';
}
function formatDefaultSummary(toolName, args) {
    const entries = Object.entries(args || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${formatScalar(value)}`)
        .filter((item) => item && !item.endsWith(': '));
    if (entries.length > 0) {
        return `${toolName} (${entries.join(', ')})`;
    }
    return toolName;
}
export function summarizeToolCall(toolName, args) {
    switch (toolName) {
        case 'bash':
            return formatBashSummary(args);
        case 'read':
            return formatReadSummary(args);
        case 'write':
            return formatWriteSummary(args);
        case 'edit':
            return formatEditSummary(args);
        case 'ls':
        case 'list':
            return formatListSummary(args);
        case 'grep':
        case 'glob':
        case 'search':
            return formatGrepSummary(args);
        case 'send_message':
            return formatSendMessageSummary(args);
        case 'spawn_agent':
            return formatSpawnSummary(args);
        default:
            return formatDefaultSummary(toolName, args);
    }
}
export function summarizeToolResult(result) {
    if (result && typeof result === 'object') {
        const typedResult = result;
        if (typedResult.success === false && typedResult.error) {
            return `Error: ${truncate(String(typedResult.error))}`;
        }
        if (typeof typedResult.data === 'string' && typedResult.data.trim()) {
            return truncate(typedResult.data);
        }
        if (typedResult.data && typeof typedResult.data === 'object') {
            return truncate(JSON.stringify(typedResult.data));
        }
        if (typedResult.error) {
            return `Error: ${truncate(String(typedResult.error))}`;
        }
    }
    if (typeof result === 'string') {
        return truncate(result);
    }
    if (result == null) {
        return '';
    }
    return truncate(JSON.stringify(result));
}
export function createQueuedToolEvent(toolName, args) {
    const summary = summarizeToolCall(toolName, args);
    return {
        kind: 'tool',
        phase: 'running',
        title: `Queued ${toolName}`,
        text: summary,
        toolName,
        toolState: 'queued',
        summary,
    };
}
export function createRunningToolEvent(toolName, args) {
    const summary = summarizeToolCall(toolName, args);
    return {
        kind: 'tool',
        phase: 'running',
        title: `Running ${toolName}`,
        text: summary,
        toolName,
        toolState: 'running',
        summary,
    };
}
export function createCompletedToolEvent(toolName, result) {
    const summary = summarizeToolResult(result) || 'Tool completed successfully.';
    return {
        kind: 'tool',
        phase: 'completed',
        title: `Completed ${toolName}`,
        text: summary,
        toolName,
        toolState: 'completed',
        summary,
    };
}
export function createFailedToolEvent(toolName, error) {
    const summary = summarizeToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
    });
    return {
        kind: 'tool',
        phase: 'completed',
        title: `Failed ${toolName}`,
        text: summary,
        toolName,
        toolState: 'failed',
        summary,
    };
}
//# sourceMappingURL=tool-activity.js.map