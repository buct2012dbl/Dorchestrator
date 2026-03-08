/**
 * MCP stdio server for inter-agent communication.
 * Uses newline-delimited JSON (the MCP SDK stdio transport format).
 * Config path passed as argv[2]: { agentId, bridgePort, connectedAgents }
 */

'use strict';

const net = require('net');
const fs = require('fs');

let agentId = 'unknown';
let bridgePort = 0;
let connectedAgents = [];

const configPath = process.argv[2];
if (configPath) {
  try {
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    agentId = cfg.agentId || agentId;
    bridgePort = cfg.bridgePort || 0;
    connectedAgents = cfg.connectedAgents || [];
  } catch (e) {
    process.stderr.write('[mcp-bridge] Config read error: ' + e.message + '\n');
  }
}

// ---- Newline-delimited JSON transport (MCP SDK stdio format) ----

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

process.stdin.setEncoding('utf8');
process.stdin.resume();

let lineBuf = '';
process.stdin.on('data', (chunk) => {
  lineBuf += chunk;
  let newlineIdx;
  while ((newlineIdx = lineBuf.indexOf('\n')) !== -1) {
    const line = lineBuf.slice(0, newlineIdx).trim();
    lineBuf = lineBuf.slice(newlineIdx + 1);
    if (!line) continue;
    try {
      handleMessage(JSON.parse(line));
    } catch (e) {
      process.stderr.write('[mcp-bridge] Parse error: ' + e.message + '\n');
    }
  }
});

// ---- TCP bridge call ----

function callBridge(payload) {
  return new Promise((resolve) => {
    if (!bridgePort) {
      return resolve({ success: false, error: 'Bridge port not configured' });
    }
    const client = net.createConnection({ port: bridgePort, host: '127.0.0.1' }, () => {
      client.write(JSON.stringify(payload) + '\n');
    });
    let buf = '';
    client.on('data', (d) => {
      buf += d.toString();
      const idx = buf.indexOf('\n');
      if (idx !== -1) {
        try { resolve(JSON.parse(buf.slice(0, idx))); } catch { resolve({ success: false }); }
        client.destroy();
      }
    });
    client.on('error', (e) => resolve({ success: false, error: e.message }));
    setTimeout(() => { client.destroy(); resolve({ success: false, error: 'Timeout' }); }, 180000);
  });
}

// ---- Message handler ----

async function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'agent-bridge', version: '1.0.0' },
      },
    });
    return;
  }

  if (method === 'notifications/initialized') return;
  if (method === 'ping') { send({ jsonrpc: '2.0', id, result: {} }); return; }

  if (method === 'tools/list') {
    const tools = connectedAgents.length > 0 ? [{
      name: 'send_message',
      description:
        'Send a message to a connected agent. ' +
        'Connected: ' + connectedAgents.map((a) => a.id + ' (' + a.role + ')').join(', ') + '. ' +
        'Use this to delegate tasks and collaborate.',
      inputSchema: {
        type: 'object',
        properties: {
          target_agent_id: {
            type: 'string',
            description: 'Agent to message. One of: ' + connectedAgents.map((a) => a.id).join(', '),
          },
          message: { type: 'string', description: 'The message to send.' },
        },
        required: ['target_agent_id', 'message'],
      },
    }] : [];
    send({ jsonrpc: '2.0', id, result: { tools } });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    if (name === 'send_message') {
      const { target_agent_id, message } = args || {};
      const result = await callBridge({ fromAgentId: agentId, targetAgentId: target_agent_id, message });
      send({
        jsonrpc: '2.0', id,
        result: {
          content: [{
            type: 'text',
            text: result.success
              ? 'Response from ' + target_agent_id + ':\n\n' + result.response
              : 'Failed to reach ' + target_agent_id + ': ' + result.error,
          }],
        },
      });
      return;
    }
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Unknown tool: ' + name } });
    return;
  }

  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found: ' + method } });
  }
}

process.on('uncaughtException', (e) => {
  process.stderr.write('[mcp-bridge] Uncaught: ' + e.message + '\n');
});
