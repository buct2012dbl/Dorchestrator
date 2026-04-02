import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
class McpClient {
    serverName;
    config;
    child = null;
    nextId = 1;
    buffer = '';
    pending = new Map();
    constructor(serverName, config) {
        this.serverName = serverName;
        this.config = config;
    }
    async connect() {
        if (this.child)
            return;
        this.child = spawn(this.config.command, this.config.args || [], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                ...this.config.env
            },
            stdio: ['pipe', 'pipe', 'pipe']
        });
        this.child.stdout.setEncoding('utf8');
        this.child.stdout.on('data', (chunk) => this.handleStdout(chunk));
        this.child.stderr.setEncoding('utf8');
        this.child.stderr.on('data', (chunk) => {
            const message = chunk.trim();
            if (message) {
                console.warn(`[MCP:${this.serverName}] ${message}`);
            }
        });
        this.child.on('exit', (code, signal) => {
            const error = new Error(`MCP server ${this.serverName} exited unexpectedly` +
                (code !== null ? ` with code ${code}` : '') +
                (signal ? ` (signal ${signal})` : ''));
            for (const { reject } of this.pending.values()) {
                reject(error);
            }
            this.pending.clear();
            this.child = null;
        });
        await this.request('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'coding-agent',
                version: '0.1.0'
            }
        });
        this.sendNotification('notifications/initialized', {});
    }
    async listTools() {
        const result = await this.request('tools/list', {});
        return Array.isArray(result?.tools) ? result.tools : [];
    }
    async callTool(name, args) {
        return this.request('tools/call', {
            name,
            arguments: args
        });
    }
    close() {
        if (!this.child)
            return;
        this.child.kill();
        this.child = null;
    }
    handleStdout(chunk) {
        this.buffer += chunk;
        let newlineIndex = this.buffer.indexOf('\n');
        while (newlineIndex !== -1) {
            const line = this.buffer.slice(0, newlineIndex).trim();
            this.buffer = this.buffer.slice(newlineIndex + 1);
            if (line) {
                this.handleMessage(line);
            }
            newlineIndex = this.buffer.indexOf('\n');
        }
    }
    handleMessage(line) {
        let message;
        try {
            message = JSON.parse(line);
        }
        catch (error) {
            console.warn(`[MCP:${this.serverName}] Failed to parse response: ${line}`);
            return;
        }
        if (typeof message.id === 'number' && this.pending.has(message.id)) {
            const pending = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) {
                pending.reject(new Error(message.error.message || `MCP error from ${this.serverName}`));
            }
            else {
                pending.resolve(message.result);
            }
        }
    }
    request(method, params) {
        if (!this.child) {
            return Promise.reject(new Error(`MCP server ${this.serverName} is not connected`));
        }
        const id = this.nextId++;
        const payload = JSON.stringify({
            jsonrpc: '2.0',
            id,
            method,
            params
        });
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.child.stdin.write(`${payload}\n`, (error) => {
                if (error) {
                    this.pending.delete(id);
                    reject(error);
                }
            });
        });
    }
    sendNotification(method, params) {
        if (!this.child)
            return;
        this.child.stdin.write(JSON.stringify({
            jsonrpc: '2.0',
            method,
            params
        }) + '\n');
    }
}
function createMcpTool(serverName, tool, client) {
    const properties = tool.inputSchema?.properties || {};
    const required = tool.inputSchema?.required || [];
    return {
        id: tool.name,
        description: tool.description || `Remote MCP tool from ${serverName}`,
        parameters: {
            type: 'object',
            properties,
            required
        },
        async execute(args, _context) {
            const normalizedArgs = normalizeBridgeToolArgs(tool.name, args);
            try {
                const result = await client.callTool(tool.name, normalizedArgs);
                return {
                    success: true,
                    data: normalizeMcpResult(result)
                };
            }
            catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error)
                };
            }
        }
    };
}
function normalizeBridgeToolArgs(toolName, args) {
    if (toolName === 'send_message') {
        return {
            ...args,
            target_agent_id: args?.target_agent_id || args?.agent_id,
            message: args?.message || args?.response
        };
    }
    if (toolName === 'send_response') {
        return {
            ...args,
            target_agent_id: args?.target_agent_id || args?.agent_id,
            response: args?.response || args?.message
        };
    }
    return args;
}
function normalizeMcpResult(result) {
    const content = Array.isArray(result?.content) ? result.content : [];
    const text = content
        .filter((item) => item?.type === 'text' && typeof item.text === 'string')
        .map((item) => item.text)
        .join('\n')
        .trim();
    if (!text) {
        return result;
    }
    return {
        content,
        text
    };
}
export async function registerMcpToolsFromEnvironment(register) {
    const configPath = process.env.CODING_AGENT_MCP_CONFIG;
    if (!configPath)
        return [];
    const configContent = await readFile(configPath, 'utf8');
    const config = JSON.parse(configContent);
    const mcpServers = config.mcpServers || {};
    const registeredToolIds = [];
    const clients = [];
    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
        const client = new McpClient(serverName, serverConfig);
        await client.connect();
        clients.push(client);
        const tools = await client.listTools();
        for (const tool of tools) {
            register(createMcpTool(serverName, tool, client));
            registeredToolIds.push(tool.name);
        }
    }
    process.on('exit', () => {
        for (const client of clients) {
            client.close();
        }
    });
    return registeredToolIds;
}
//# sourceMappingURL=mcp-tools.js.map