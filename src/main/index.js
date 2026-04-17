const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { spawn } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { AgentOrchestrator } = require('./orchestrator');
const WhisperManager = require('./whisperManager');
const pty = require('node-pty');
const commConfig = require('./communication-config');
const graphConfigManager = require('./graphConfigManager');
const swarmManager = require('./swarmManager');
const sharedAgentManager = require('./sharedAgentManager');
const kanbanManager = require('./kanbanManager');
const { extractCliTimelineEvents } = require('./kanbanTimeline');
const templateManager = require('./templateManager');
const {
  syncAgentsAndRespawn,
  resizeTrackedPty,
  killTrackedPtyById,
} = require('./ptyLifecycle');

// Setup logging to file in production
const logFile = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function formatAgentLogLabel(agentId, logPrefix = '[PTY]') {
  return `${logPrefix} agent=${agentId || 'unknown'}`;
}

function log(...args) {
  const message = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(...args);
  if (!app.isPackaged || !logStream.writable) return;
  try {
    logStream.write(message + '\n');
  } catch {}
}

// Override console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args) => {
  originalConsoleLog(...args);
  if (app.isPackaged && logStream.writable) {
    try {
      logStream.write(`[${new Date().toISOString()}] ${args.join(' ')}\n`);
    } catch {}
  }
};
console.error = (...args) => {
  originalConsoleError(...args);
  if (app.isPackaged && logStream.writable) {
    try {
      logStream.write(`[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`);
    } catch {}
  }
};

log('App starting...');
log('Packaged file logging initialized');
log('App version:', app.getVersion());
log('Electron version:', process.versions.electron);
log('Node version:', process.versions.node);
log('Platform:', process.platform);
log('Architecture:', process.arch);

let mainWindow;
let orchestrator;
let whisperManager;

// ---- Find node executable (needed for MCP bridge) ----
const { execSync } = require('child_process');

function findNode() {
  try {
    const r = execSync('which node', { encoding: 'utf8', timeout: 2000 }).trim();
    if (r && fs.existsSync(r)) return r;
  } catch {}
  const nvmNode = path.join(os.homedir(), '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmNode)) {
    try {
      const versions = fs.readdirSync(nvmNode).sort().reverse();
      for (const v of versions) {
        const p = path.join(nvmNode, v, 'bin', 'node');
        if (fs.existsSync(p)) return p;
      }
    } catch {}
  }
  for (const p of ['/usr/local/bin/node', '/opt/homebrew/bin/node', '/usr/bin/node']) {
    if (fs.existsSync(p)) return p;
  }
  return 'node';
}

function findClaude() {
  try {
    const r = execSync('which claude', { encoding: 'utf8', timeout: 2000 }).trim();
    if (r && fs.existsSync(r)) return r;
  } catch {}
  const nvmNode = path.join(os.homedir(), '.nvm', 'versions', 'node');
  if (fs.existsSync(nvmNode)) {
    try {
      const versions = fs.readdirSync(nvmNode).sort().reverse();
      for (const v of versions) {
        const p = path.join(nvmNode, v, 'bin', 'claude');
        if (fs.existsSync(p)) return p;
      }
    } catch {}
  }
  for (const p of ['/usr/local/bin/claude', '/opt/homebrew/bin/claude']) {
    if (fs.existsSync(p)) return p;
  }
  return 'claude';
}

const NODE_PATH = findNode();
const CLAUDE_PATH = findClaude();

function getCodingAgentCliPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'coding-agent', 'dist', 'cli', 'index.js');
  }
  return path.join(__dirname, '../../coding-agent/dist/cli/index.js');
}

function getCodexAutoApproveArgs() {
  return [
    '--sandbox', 'workspace-write',
    '-c', 'default_tools_approval_mode="approve"',
  ];
}

function buildTerminalCommand(config = {}, options = {}) {
  const {
    allowShell = false,
    codingAgentConfigPath,
    codingAgentAgentId,
    logPrefix = '[PTY]',
    logId,
  } = options;

  const terminalType = config.terminalType || config.cliType || 'claude-code';
  let command;
  let args;

  if (allowShell && terminalType === 'shell') {
    command = process.env.SHELL || '/bin/zsh';
    args = [];
  } else if (terminalType === 'codex') {
    command = process.env.CODEX_PATH || 'codex';
    args = getCodexAutoApproveArgs();
    if (config.model) args.push('--model', config.model);
    if (config.systemPrompt) args.push('-c', `instructions=${JSON.stringify(config.systemPrompt)}`);
    if (config.name) {
      console.log(`${logPrefix} Codex agent name: ${config.name}`);
    }
  } else if (terminalType === 'coding-agent') {
    command = NODE_PATH;
    const codingAgentPath = getCodingAgentCliPath();
    if (!fs.existsSync(codingAgentPath)) {
      throw new Error(`Built-in coding-agent CLI not found at ${codingAgentPath}. Build coding-agent before launching.`);
    }
    args = [codingAgentPath, 'start'];
    if (codingAgentConfigPath) args.push('--config', codingAgentConfigPath);
    if (config.model) args.push('--model', config.model);
    if (codingAgentAgentId) args.push('--agent', codingAgentAgentId);
    if (config.systemPrompt) args.push('--system-prompt', config.systemPrompt);
    if (config.name) {
      console.log(`${logPrefix} Coding agent name: ${config.name}`);
    }
  } else {
    command = process.env.CLAUDE_PATH || CLAUDE_PATH;
    args = [];
    if (config.model) args.push('--model', config.model);
    if (config.systemPrompt) {
      args.push('--append-system-prompt', config.systemPrompt);
    }
    if (config.name) {
      console.log(`${logPrefix} Agent name: ${config.name}`);
    }
  }

  return { terminalType, command, args };
}

// ---- Agent graph (kept in sync for PTY spawning) ----
let agentGraph = { agents: [], edges: [] };
const runtimeTaskGraphs = new Map();
const taskAgentIndex = new Map();
const activeKanbanTasks = new Map();

function getCombinedGraph() {
  const agents = [...(agentGraph.agents || [])];
  const edges = [...(agentGraph.edges || [])];

  for (const runtimeGraph of runtimeTaskGraphs.values()) {
    agents.push(...(runtimeGraph.agents || []));
    edges.push(...(runtimeGraph.edges || []));
  }

  return { agents, edges };
}

function findAgentById(agentId) {
  return getCombinedGraph().agents.find((agent) => agent.id === agentId) || null;
}

function getConnectedAgents(agentId) {
  const { agents, edges } = getCombinedGraph();
  const connected = new Set();
  for (const edge of edges) {
    if (edge.source === agentId) connected.add(edge.target);
    if (edge.target === agentId) connected.add(edge.source);
  }
  return agents
    .filter((a) => connected.has(a.id))
    .map((a) => ({ id: a.id, role: a.data?.role || '', name: a.data?.name || '' }));
}

function buildPtyEnvironment() {
  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG || 'en_US.UTF-8',
    PATH: `${path.dirname(NODE_PATH)}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
  };

  if (authConfig.authToken) env.ANTHROPIC_API_KEY = authConfig.authToken;
  if (authConfig.baseURL) env.ANTHROPIC_BASE_URL = authConfig.baseURL;

  return env;
}

function getPtyWorkingDirectory() {
  return workspace || process.env.HOME || '/';
}

function killTrackedPty(ptyMap, dimsMap, id) {
  if (!ptyMap.has(id)) return;
  try { ptyMap.get(id).kill(); } catch {}
  ptyMap.delete(id);
  dimsMap.delete(id);
}

function getMcpBridgePath(tmpDir, logPrefix) {
  if (!app.isPackaged) {
    return path.join(__dirname, 'mcp-bridge.js');
  }

  const sourcePath = path.join(process.resourcesPath, 'app.asar', 'src', 'main', 'mcp-bridge.js');
  const targetPath = path.join(tmpDir, 'ao-mcp-bridge.js');

  try {
    if (!fs.existsSync(targetPath)) {
      const bridgeContent = fs.readFileSync(sourcePath, 'utf8');
      fs.writeFileSync(targetPath, bridgeContent);
      console.log(`${logPrefix} Copied MCP bridge helper into temporary app storage`);
    }
  } catch (err) {
    console.error(`${logPrefix} Failed to copy MCP bridge:`, err.message);
  }

  return targetPath;
}

function getCodexConfigPath() {
  return path.join(os.homedir(), '.codex', 'config.toml');
}

function getCodexAuthPath() {
  return path.join(os.homedir(), '.codex', 'auth.json');
}

function getCodexBridgeServerName(agentId) {
  return `agent-bridge-${agentId}`;
}

function getCodexAgentHome(agentId) {
  return path.join(os.tmpdir(), 'ao-codex-home', agentId);
}

function stripCodexMcpSections(content) {
  const lines = content.split('\n');
  const kept = [];
  let skipSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      skipSection = trimmed.startsWith('[mcp_servers.');
    }

    if (!skipSection) {
      kept.push(line);
    }
  }

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function ensureCodexMcpToolApprovals(content, mcpServerName) {
  const tools = ['send_message', 'send_response'];
  let nextContent = content;

  for (const toolName of tools) {
    const header = `[mcp_servers.${mcpServerName}.tools.${toolName}]`;
    const blockRegex = new RegExp(
      `(^|\\n)\\[mcp_servers\\.${mcpServerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.tools\\.${toolName}\\]\\n(?:[^\\[]*\\n)*?approval_mode = "([^"]+)"`,
      'm'
    );

    if (blockRegex.test(nextContent)) {
      nextContent = nextContent.replace(blockRegex, (match, prefix) => {
        if (match.includes('approval_mode = "approve"')) {
          return match;
        }
        return `${prefix}${header}\napproval_mode = "approve"`;
      });
      continue;
    }

    if (!nextContent.endsWith('\n')) {
      nextContent += '\n';
    }
    nextContent += `\n${header}\napproval_mode = "approve"\n`;
  }

  return nextContent;
}

function prepareIsolatedCodexHome(agentId, env, logPrefix, bridgeInfo = null) {
  const agentHome = getCodexAgentHome(agentId);
  const configPath = path.join(agentHome, 'config.toml');
  const authPath = getCodexAuthPath();
  const globalConfigPath = getCodexConfigPath();

  fs.mkdirSync(agentHome, { recursive: true });

  if (fs.existsSync(authPath)) {
    fs.copyFileSync(authPath, path.join(agentHome, 'auth.json'));
  }

  let configContent = '';
  if (fs.existsSync(globalConfigPath)) {
    configContent = fs.readFileSync(globalConfigPath, 'utf8');
  }

  configContent = stripCodexMcpSections(configContent);
  if (configContent && !configContent.endsWith('\n')) {
    configContent += '\n';
  }

  if (bridgeInfo) {
    const mcpServerName = getCodexBridgeServerName(agentId);
    configContent += `\n[mcp_servers.${mcpServerName}]\n`;
    configContent += `command = ${JSON.stringify(NODE_PATH)}\n`;
    configContent += `args = [${JSON.stringify(bridgeInfo.mcpBridgePath)}, ${JSON.stringify(bridgeInfo.bridgeConfigPath)}]\n`;
    configContent = ensureCodexMcpToolApprovals(configContent, mcpServerName);
  }

  fs.writeFileSync(configPath, configContent);
  env.CODEX_HOME = agentHome;
  console.log(`${formatAgentLogLabel(agentId, logPrefix)} prepared isolated Codex home`);

  return agentHome;
}

function writeBridgeConfig(agentId, logPrefix) {
  const connectedAgents = getConnectedAgents(agentId);
  if (connectedAgents.length === 0) {
    return null;
  }

  const tmpDir = os.tmpdir();
  const mcpBridgePath = getMcpBridgePath(tmpDir, logPrefix);
  const bridgeConfigPath = path.join(tmpDir, `ao-bridge-cfg-${agentId}.json`);
  const bridgeConfig = { agentId, bridgePort, connectedAgents };

  fs.writeFileSync(bridgeConfigPath, JSON.stringify(bridgeConfig));
  console.log(`${formatAgentLogLabel(agentId, logPrefix)} wrote bridge config for ${connectedAgents.length} connected agents`);

  return { connectedAgents, mcpBridgePath, bridgeConfigPath };
}

function prepareAgentMcpSession(agentId, terminalType, command, args, env, logPrefix) {
  if (terminalType === 'codex') {
    try {
      const bridgeInfo = bridgePort > 0 ? writeBridgeConfig(agentId, logPrefix) : null;
      prepareIsolatedCodexHome(agentId, env, logPrefix, bridgeInfo);
      return () => {};
    } catch (err) {
      console.error(`${logPrefix} Failed to prepare isolated Codex MCP config:`, err.message);
      return () => {};
    }
  }

  if (bridgePort <= 0) {
    return () => {};
  }

  const bridgeInfo = writeBridgeConfig(agentId, logPrefix);
  if (!bridgeInfo) {
    return () => {};
  }
  const tmpDir = os.tmpdir();
  const { mcpBridgePath, bridgeConfigPath } = bridgeInfo;

  const mcpConfig = {
    mcpServers: {
      'agent-bridge': {
        command: NODE_PATH,
        args: [mcpBridgePath, bridgeConfigPath],
      },
    },
  };

  if (terminalType === 'coding-agent') {
    const mcpConfigPath = path.join(tmpDir, `ao-coding-agent-mcp-${agentId}.json`);
    try {
      fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig));
      env.CODING_AGENT_MCP_CONFIG = mcpConfigPath;
      console.log(`${formatAgentLogLabel(agentId, logPrefix)} wrote coding-agent MCP config`);
    } catch (err) {
      console.error(`${logPrefix} Failed to write MCP config for coding-agent:`, err.message);
    }
    return () => {};
  }

  const mcpConfigPath = path.join(tmpDir, `ao-mcp-${agentId}.json`);
  try {
    fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig));
    args.push('--mcp-config', mcpConfigPath);
    console.log(`${formatAgentLogLabel(agentId, logPrefix)} wrote MCP config`);
  } catch (err) {
    console.error(`${logPrefix} Failed to write MCP config:`, err.message);
  }

  return () => {};
}

function spawnTrackedPty({
  ptyId,
  command,
  args,
  cols = 80,
  rows = 24,
  env,
  ptyMap,
  dimsMap,
  idKey,
  dataChannel,
  exitChannel,
  logPrefix,
  onData,
  onExit,
}) {
  console.log(`${formatAgentLogLabel(ptyId, logPrefix)} spawning terminalType command=${path.basename(command)} argCount=${args.length}`);

  const ptyProcess = pty.spawn(command, args, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: getPtyWorkingDirectory(),
    env,
  });

  ptyProcess.onData((data) => {
    if (onData) onData(data);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(dataChannel, { [idKey]: ptyId, data });
    }
  });

  ptyProcess.onExit(({ exitCode }) => {
    console.log(`${logPrefix} Process exited with code ${exitCode} for ${ptyId}`);
    const isCurrent = ptyMap.get(ptyId) === ptyProcess;

    if (isCurrent) {
      ptyMap.delete(ptyId);
      dimsMap.delete(ptyId);
    }

    if (onExit) onExit(exitCode, { isCurrent });

    if (isCurrent && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(exitChannel, { [idKey]: ptyId, exitCode });
    }
  });

  ptyMap.set(ptyId, ptyProcess);
  dimsMap.set(ptyId, { cols, rows });
  return ptyProcess;
}

function forwardAgentPtyData(agentId, data) {
  const { cleanText, events } = extractCliTimelineEvents(data);

  events.forEach((event) => {
    appendKanbanTaskAgentTimelineEvent(agentId, event);
  });

  appendKanbanSegment(agentId, cleanText);
  const oscMatch = cleanText.match(/\x1b\](?:9|99|777);([^\x07\x1b]{3,})(?:\x07|\x1b\\)/);
  if (oscMatch && /[a-zA-Z]/.test(oscMatch[1])) {
    const notification = oscMatch[1];
    if (notification.startsWith('AO_KANBAN_EVENT:')) {
      return;
    }
    console.log(`[Notification] agent=${agentId} terminal notification received (${notification.length} chars)`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('agent-notification', { agentId, message: notification });
    }
  }
}

// ---- TCP bridge server for inter-agent messaging ----
let bridgePort = 0;

async function ensureAgentPtyRunning(agentId) {
  let ptyProcess = ptys.get(agentId);
  if (ptyProcess) return ptyProcess;

  const targetAgent = findAgentById(agentId);
  if (!targetAgent?.data) {
    throw new Error(`Target agent ${agentId} not found in graph`);
  }

  const dims = ptyDims.get(agentId) || { cols: 80, rows: 24 };
  const result = spawnPty(agentId, targetAgent.data, dims.cols, dims.rows);
  if (!result?.success) {
    throw new Error(result?.error || `Failed to start target agent ${agentId}`);
  }

  for (let attempt = 0; attempt < 20; attempt++) {
    ptyProcess = ptys.get(agentId);
    if (ptyProcess) return ptyProcess;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Target agent ${agentId} did not become ready`);
}

function waitForAgentPtyReady(agentId, options = {}) {
  const {
    minWaitMs = 800,
    settleMs = 1200,
    maxWaitMs = 8000,
  } = options;

  return new Promise((resolve) => {
    const ptyProcess = ptys.get(agentId);
    if (!ptyProcess) {
      setTimeout(resolve, minWaitMs);
      return;
    }

    let sawData = false;
    let settled = false;
    let settleTimer = null;
    let maxTimer = null;
    const startedAt = Date.now();

    const finish = () => {
      if (settled) return;
      settled = true;
      if (settleTimer) clearTimeout(settleTimer);
      if (maxTimer) clearTimeout(maxTimer);
      try { disposable.dispose(); } catch {}
      const waited = Date.now() - startedAt;
      const remainingMinWait = Math.max(0, minWaitMs - waited);
      if (remainingMinWait > 0) {
        setTimeout(resolve, remainingMinWait);
      } else {
        resolve();
      }
    };

    const scheduleSettle = () => {
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        if (sawData) finish();
      }, settleMs);
    };

    const disposable = ptyProcess.onData((data) => {
      if (!data) return;
      sawData = true;
      scheduleSettle();
    });

    maxTimer = setTimeout(finish, maxWaitMs);
    scheduleSettle();
  });
}

function normalizeBridgeAgentId(rawAgentId) {
  if (!rawAgentId || typeof rawAgentId !== 'string') return rawAgentId;
  const bracketMatch = rawAgentId.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1].trim();
  return rawAgentId.trim();
}

function startBridgeServer() {
  return new Promise((resolve) => {
  const server = net.createServer(async (socket) => {
    let buf = '';
    socket.on('data', async (chunk) => {
      buf += chunk.toString();
      const idx = buf.indexOf('\n');
      if (idx === -1) return;
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      let msg;
      try { msg = JSON.parse(line); } catch { socket.write(JSON.stringify({ success: false, error: 'Bad JSON' }) + '\n'); return; }

      const { fromAgentId, targetAgentId, message, kind = 'message' } = msg;
      const normalizedTargetAgentId = normalizeBridgeAgentId(targetAgentId);
      console.log(`[Bridge] ${fromAgentId} → ${normalizedTargetAgentId} (${kind}, ${message ? message.length : 0} chars)`);

      const fromAgent = findAgentById(fromAgentId);
      const fromName = fromAgent?.data?.name || fromAgentId;

      // Check target agent's terminal type
      const targetAgent = findAgentById(normalizedTargetAgentId);
      const terminalType = targetAgent?.data?.terminalType || 'claude-code';

      try {
        // Auto-start the target PTY on demand so bridge tools work even if the panel
        // has not been opened yet in the renderer.
        const ptyProcess = await ensureAgentPtyRunning(normalizedTargetAgentId);

        const fullMessage = kind === 'response'
          ? `[Response from ${fromName}]: ${message}`
          : `[Message from ${fromName}]: ${message}`;
        console.log(`[Bridge] Delivering message to ${normalizedTargetAgentId}`);

        if (kind === 'response') {
          // Responses are informational and should not be re-processed as fresh work,
          // otherwise agents can get stuck acknowledging each other forever.
          ptyProcess.write(`\r\n\x1b[36m${fullMessage}\x1b[0m\r\n\r\n`);
        } else if (terminalType === 'codex') {
          // Codex does not reliably process foreign input injected into the live PTY.
          // Reuse the dedicated exec path so the message is actually handled.
          void getAgentResponse(normalizedTargetAgentId, fullMessage)
            .then((result) => {
              console.log(`[Bridge] Codex background handling completed for ${normalizedTargetAgentId} (${String(result?.response || '').length} chars)`);
            })
            .catch((err) => {
              console.error(`[Bridge] Codex background handling failed for ${normalizedTargetAgentId}:`, err.message);
            });
        } else {
          ptyProcess.write(fullMessage + '\r');
        }

        // Return immediately - receiver will send response via send_response tool
        socket.write(JSON.stringify({ success: true, delivered: true }) + '\n');
      } catch (err) {
        console.error('[Bridge] Error:', err.message);
        socket.write(JSON.stringify({ success: false, error: err.message }) + '\n');
      }
    });
    socket.on('error', () => {});
  });

  server.listen(0, '127.0.0.1', () => {
    bridgePort = server.address().port;
    console.log(`[Bridge] Listening on port ${bridgePort}`);
    resolve();
  });
  }); // end Promise
}

// ---- Get agent response by writing to its active PTY stdin and capturing output ----
function getAgentResponse(agentId, message, options = {}) {
  return new Promise((resolve) => {
    // Find the target agent to check its terminal type
    const targetAgent = findAgentById(agentId);
    const terminalType = targetAgent?.data?.terminalType || 'claude-code';

    if (terminalType === 'coding-agent') {
      console.log(`[Bridge] Built-in coding-agent detected for ${agentId}; spawning exec command (${message.length} chars)`);

      const codingAgentPath = getCodingAgentCliPath();
      const outputPath = path.join(os.tmpdir(), `ao-coding-agent-last-message-${agentId}-${Date.now()}.txt`);
      const args = [codingAgentPath, 'exec', '--agent', agentId, '--output-last-message', outputPath];
      const configPath = path.join(os.homedir(), '.dorchestrator', 'coding-agent', 'config', 'agents.json');
      if (fs.existsSync(configPath)) {
        args.push('--config', configPath);
      }
      if (targetAgent?.data?.model) args.push('--model', targetAgent.data.model);
      if (targetAgent?.data?.systemPrompt) args.push('--system-prompt', targetAgent.data.systemPrompt);
      args.push(message);

      const execEnv = buildPtyEnvironment();
      prepareAgentMcpSession(agentId, terminalType, NODE_PATH, args, execEnv, '[Bridge]');

      const execProcess = spawn(NODE_PATH, args, {
        cwd: workspace || process.env.HOME || '/',
        env: execEnv,
      });

      let output = '';
      let renderedTranscript = '';
      let done = false;
      let safetyTimer = null;
      let processError = null;
      let exitCode = null;

      const finishCodingAgentExec = (fallbackResponse = '(no response)') => {
        if (done) return;
        done = true;
        if (safetyTimer) clearTimeout(safetyTimer);

        let finalResponse = fallbackResponse;
        try {
          if (fs.existsSync(outputPath)) {
            const fileResponse = fs.readFileSync(outputPath, 'utf8').trim();
            if (fileResponse) {
              finalResponse = fileResponse;
            }
            fs.unlinkSync(outputPath);
          }
        } catch {}

        resolve({
          response: finalResponse,
          transcript: renderedTranscript.trimEnd(),
          error: processError || (finalResponse === '(no response)' ? `Task failed before producing a final response${exitCode !== null ? ` (exit ${exitCode})` : ''}.` : null),
        });
      };

      execProcess.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;

        const { cleanText, events } = extractCliTimelineEvents(text);
        events.forEach((event) => appendKanbanTaskAgentTimelineEvent(agentId, event));

        const normalized = cleanText
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
          .replace(/\x1b[()][0-9A-Za-z]/g, '');

        if (normalized.trim()) {
          renderedTranscript += normalized;
        }
      });

      execProcess.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        if (text.trim()) {
          processError = processError ? `${processError}\n${text.trim()}` : text.trim();
          renderedTranscript += text;
        }
      });

      execProcess.on('close', (code) => {
        exitCode = code;
        finishCodingAgentExec();
      });

      safetyTimer = setTimeout(() => {
        finishCodingAgentExec('(timeout)');
      }, 180000);

      return;
    }

    const ptyProcess = ptys.get(agentId);
    if (!ptyProcess) {
      resolve({ response: '(agent not running)', transcript: '' });
      return;
    }

    // For Codex agents, use exec command to process the message
    if (terminalType === 'codex') {
      console.log(`[Bridge] Codex agent detected for ${agentId}; spawning exec command (${message.length} chars)`);

      // Show incoming message in terminal
      ptyProcess.write(`\r\n\x1b[36m[Incoming message]\x1b[0m ${message}\r\n\r\n`);

      const codexPath = process.env.CODEX_PATH || 'codex';
      const codexOutputPath = path.join(os.tmpdir(), `ao-codex-last-message-${agentId}-${Date.now()}.txt`);
      const args = ['exec', ...getCodexAutoApproveArgs(), '--skip-git-repo-check', '--json', '--output-last-message', codexOutputPath];
      if (targetAgent?.data?.model) args.push('--model', targetAgent.data.model);
      if (targetAgent?.data?.systemPrompt) args.push('-c', `instructions=${JSON.stringify(targetAgent.data.systemPrompt)}`);
      args.push(message);
      const codexEnv = { ...process.env };

      try {
        const bridgeInfo = writeBridgeConfig(agentId, '[Bridge]');
        prepareIsolatedCodexHome(agentId, codexEnv, '[Bridge]', bridgeInfo);
      } catch (err) {
        console.error(`[Bridge] Failed to configure Codex MCP server for ${agentId}:`, err.message);
      }

      const { spawn } = require('child_process');
      const execProcess = spawn(codexPath, args, {
        cwd: workspace || process.env.HOME || '/',
        env: codexEnv,
      });

      let output = '';
      let renderedTranscript = '';
      let stdoutBuffer = '';
      let done = false;
      let safetyTimer = null;
      let finalMessageFromEvents = '';
      let errorMessageFromEvents = '';
      const onCodexEvent = typeof options.onCodexEvent === 'function' ? options.onCodexEvent : null;

      const finishCodexExec = (fallbackResponse = '(no response)') => {
        if (done) return;
        done = true;
        if (safetyTimer) clearTimeout(safetyTimer);
        ptyProcess.write(`\x1b[36m[Response sent]\x1b[0m\r\n\r\n`);

        let finalResponse = fallbackResponse;
        try {
          if (fs.existsSync(codexOutputPath)) {
            const fileResponse = fs.readFileSync(codexOutputPath, 'utf8').trim();
            if (fileResponse) {
              finalResponse = fileResponse;
            }
            fs.unlinkSync(codexOutputPath);
          }
        } catch {}

        const clean = output
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
          .replace(/\x1b[()][0-9A-Za-z]/g, '')
          .replace(/\r/g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        finalResponse = finalResponse || finalMessageFromEvents || extractFinalResponse(clean) || clean || fallbackResponse;
        console.log(`[Bridge] Codex exec completed, outputLength=${clean.length}`);
        resolve({
          response: finalResponse,
          transcript: renderedTranscript.trimEnd(),
          error: errorMessageFromEvents || null,
        });
      };

      execProcess.stdout.on('data', (data) => {
        output += data.toString();
        stdoutBuffer += data.toString();

        const lines = stdoutBuffer.split('\n');
        stdoutBuffer = lines.pop() || '';

        for (const line of lines) {
          const timelineEvent = parseCodexTimelineEvent(line);
          if (timelineEvent && onCodexEvent) {
            onCodexEvent(timelineEvent);
          }

          const formatted = formatCodexJsonEvent(line);
          if (formatted && formatted.trim()) {
            ptyProcess.write(`${formatted}\r\n`);
            renderedTranscript += `${formatted}\n`;
          }

          const finalCandidate = extractCodexFinalMessage(line);
          if (finalCandidate) {
            finalMessageFromEvents = finalCandidate;
          }

          const errorCandidate = extractCodexErrorMessage(line);
          if (errorCandidate) {
            errorMessageFromEvents = errorCandidate;
            renderedTranscript += `[error] ${errorCandidate}\n`;
            ptyProcess.write(`[error] ${errorCandidate}\r\n`);
          }
        }
      });
      execProcess.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        const normalized = text.trim();
        if (
          normalized
          && !normalized.toLowerCase().includes('warning:')
          && !normalized.includes('Reading additional input from stdin')
        ) {
          ptyProcess.write(`${normalized}\r\n`);
          renderedTranscript += `${normalized}\n`;
        }
      });

      execProcess.on('close', () => {
        finishCodexExec();
      });

      execProcess.stdin.end();

      // Safety timeout
      safetyTimer = setTimeout(() => {
        finishCodexExec('(timeout)');
      }, 180000);

      return;
    }

    // Claude Code: use PTY stdin approach
    let captured = '';
    let idleTimer = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (idleTimer) clearTimeout(idleTimer);
      if (disposable) disposable.dispose();
      // Strip ANSI escape codes for clean text back to sender
      const clean = captured
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b[()][0-9A-Za-z]/g, '')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Log full output for debugging
      console.log(`[Bridge] Full response from ${agentId}: ${clean.length} chars`);

      // Extract final response (look for ⏺ marker or text after "thought for Xs")
      const finalResponse = extractFinalResponse(clean);
      console.log(`[Bridge] Extracted final response length for ${agentId}: ${finalResponse.length}`);

      resolve({ response: finalResponse || '(no response)', transcript: captured });
    };

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);

      if (commConfig.timeout.adaptive) {
        outputCount++;

        // Adaptive timeout: if agent is actively outputting, use longer timeout
        if (outputCount > 10) {
          idleTimeout = Math.min(4000, maxIdleTimeout); // Increase to 4s for active agents
        }
      }

      idleTimer = setTimeout(finish, idleTimeout);
    };

    let idleTimeout = commConfig.timeout.idleStart;
    const maxIdleTimeout = commConfig.timeout.idleMax;
    let outputCount = 0;

    // Attach a secondary onData listener to capture response
    const disposable = ptyProcess.onData((data) => {
      captured += data;
      resetIdle();
    });

    // Write message to PTY stdin (works for Claude Code with MCP)
    console.log(`[Bridge] Sending message to Claude Code agent ${agentId} (${message.length} chars)`);
    ptyProcess.write(message + '\r');
    resetIdle();

    // Safety timeout: 3 minutes
    setTimeout(finish, commConfig.timeout.safety);
  });
}

function extractFinalResponse(rawOutput) {
  // Look for the ⏺ marker which indicates the final response
  // Capture everything after it until we hit UI noise or end
  const recordMarkerIndex = rawOutput.indexOf('⏺');
  if (recordMarkerIndex !== -1) {
    // Get everything after the marker
    let response = rawOutput.slice(recordMarkerIndex + 1);

    // Find where the response ends (next prompt or UI noise)
    const endMarkers = [
      /\n\s*❯\s*$/m,
      /\n\s*⏵⏵/m,
      /\n\s*─{10,}/m,
      /\n\s*bypass permissions/mi,
    ];

    let endIndex = response.length;
    for (const marker of endMarkers) {
      const match = response.match(marker);
      if (match && match.index < endIndex) {
        endIndex = match.index;
      }
    }

    response = response.slice(0, endIndex).trim();

    if (response.length > 0) {
      return response;
    }
  }

  // Alternative: look for text after "(thought for Xs)" marker
  const lines = rawOutput.split('\n');
  let foundThought = false;
  const responseLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Mark when we see the thought completion
    if (line.match(/\(thought for \d+s\)/)) {
      foundThought = true;
      continue;
    }

    // After thought marker, collect non-empty, non-UI lines
    if (foundThought && line.length > 0) {
      // Skip UI noise
      if (line.match(/^[❯⏵·✢✳✶✻✽─═]+$/) ||
          line.match(/^bypass|shift|tab|esc to|Nucleating|Cogitating|Choreographing/i)) {
        continue;
      }

      // This looks like actual content
      if (line.length > 10) {
        responseLines.push(line);
      }
    }
  }

  if (responseLines.length > 0) {
    return responseLines.join(' ').trim();
  }

  // Fallback: return the original
  return rawOutput;
}

function stripAnsiAndControl(text) {
  return String(text || '')
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\x1b[()][0-9A-Za-z]/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function collectJsonStringValues(value, results = []) {
  if (typeof value === 'string') {
    results.push(value);
    return results;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonStringValues(item, results);
    }
    return results;
  }
  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectJsonStringValues(nested, results);
    }
  }
  return results;
}

function compactCodexCommand(command) {
  const clean = stripAnsiAndControl(command || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'command';
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

function parseCodexTimelineEvent(line) {
  if (!line.trim()) return null;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }

  const type = String(event.type || '');
  const item = event.item || null;

  if (type === 'item.started' && item?.type === 'command_execution') {
    return {
      kind: 'command',
      phase: 'running',
      title: 'Running command',
      text: compactCodexCommand(item.command || item.cmd || item.input || ''),
    };
  }

  if (type === 'item.completed' && item?.type === 'command_execution') {
    return {
      kind: 'command',
      phase: 'completed',
      title: `Command finished${Number.isInteger(item.exit_code) ? ` (${item.exit_code})` : ''}`,
      text: compactCodexCommand(item.command || item.cmd || item.input || ''),
      exitCode: Number.isInteger(item.exit_code) ? item.exit_code : null,
    };
  }

  if (type === 'item.completed' && item?.type === 'agent_message') {
    const text = stripAnsiAndControl(item.text || item.message || '').trim();
    if (!text) return null;
    return {
      kind: 'assistant',
      phase: 'completed',
      title: 'Assistant',
      text,
    };
  }

  if (type.includes('error') || type.includes('failed')) {
    const text = stripAnsiAndControl(
      event.message
      || event.error?.message
      || collectJsonStringValues(event).find(Boolean)
      || '',
    ).trim();
    if (!text) return null;
    return {
      kind: 'error',
      phase: 'completed',
      title: 'Error',
      text,
    };
  }

  return null;
}

function formatCodexJsonEvent(line) {
  const timelineEvent = parseCodexTimelineEvent(line);
  if (timelineEvent?.kind === 'assistant') {
    return timelineEvent.text;
  }
  if (timelineEvent?.kind === 'error') {
    return `[error] ${timelineEvent.text}`;
  }
  return null;
}

function extractCodexFinalMessage(line) {
  if (!line.trim()) return null;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }

  const type = String(event.type || '');
  if (!type.includes('message') && !type.includes('turn')) {
    return null;
  }

  const candidates = collectJsonStringValues(event)
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => !value.startsWith('{') && !value.includes('"type":'));

  return candidates.find((value) => value.length > 1) || null;
}

function extractCodexErrorMessage(line) {
  if (!line.trim()) return null;

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    return null;
  }

  const type = String(event.type || '');
  if (!type.includes('error') && !type.includes('failed')) {
    return null;
  }

  return event.message || event.error?.message || collectJsonStringValues(event).find(Boolean) || null;
}

// ---- Persistent settings ----
function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function normalizeOptionalString(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function validateBaseURL(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  let parsedUrl;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    throw new Error('Base URL must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Base URL must use http or https');
  }

  return parsedUrl.toString().replace(/\/$/, '');
}

function validateWorkspacePath(value) {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    throw new Error('Workspace path is required');
  }

  let stats;
  try {
    stats = fs.statSync(normalized);
  } catch {
    throw new Error('Workspace path does not exist');
  }

  if (!stats.isDirectory()) {
    throw new Error('Workspace path must be a directory');
  }

  return normalized;
}

function encryptSetting(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return null;
  return safeStorage.encryptString(value).toString('base64');
}

function decryptSetting(value) {
  if (!value || !safeStorage.isEncryptionAvailable()) return null;
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch (error) {
    log('Failed to decrypt secure setting:', error.message);
    return null;
  }
}

function writeSecureAuthSettings(nextSettings, authToken, baseURL) {
  delete nextSettings.authToken;
  delete nextSettings.baseURL;

  const encryptedAuthToken = encryptSetting(authToken);
  const encryptedBaseURL = encryptSetting(baseURL);

  if (encryptedAuthToken) nextSettings.secureAuthToken = encryptedAuthToken;
  else delete nextSettings.secureAuthToken;

  if (encryptedBaseURL) nextSettings.secureBaseURL = encryptedBaseURL;
  else delete nextSettings.secureBaseURL;
}

function readSecureAuthSettings(savedSettings) {
  const secureAuthToken = decryptSetting(savedSettings.secureAuthToken);
  const secureBaseURL = decryptSetting(savedSettings.secureBaseURL);
  const legacyAuthToken = typeof savedSettings.authToken === 'string' ? savedSettings.authToken : null;
  const legacyBaseURL = typeof savedSettings.baseURL === 'string' ? savedSettings.baseURL : null;
  const shouldMigrateLegacy = Boolean(legacyAuthToken || legacyBaseURL);

  if (secureAuthToken || secureBaseURL) {
    return {
      authToken: secureAuthToken,
      baseURL: secureBaseURL,
      shouldMigrateLegacy,
    };
  }

  return {
    authToken: legacyAuthToken,
    baseURL: legacyBaseURL,
    shouldMigrateLegacy,
  };
}

let settings = {};
let workspace = null; // current working directory for PTY sessions

// PTY management
const ptys = new Map();     // agentId -> pty instance
const ptyDims = new Map();  // agentId -> { cols, rows }
const muxPtys = new Map();  // terminalId -> pty instance (for mux mode)
const muxPtyDims = new Map(); // terminalId -> { cols, rows }
let authConfig = {
  authToken: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || null,
  baseURL: process.env.ANTHROPIC_BASE_URL || null,
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function emitKanbanTaskUpdate(task) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('kanban-task-update', { task });
  }
}

function loadKanbanState() {
  return kanbanManager.loadState();
}

function saveKanbanState(state) {
  return kanbanManager.saveState(state);
}

function queuePersistKanbanTask(taskId) {
  const active = activeKanbanTasks.get(taskId);
  if (!active) return;

  if (active.persistTimer) {
    clearTimeout(active.persistTimer);
  }

  active.persistTimer = setTimeout(() => {
    const state = loadKanbanState();
    const nextTasks = state.tasks.map((task) => (
      task.id === taskId ? clone(active.task) : task
    ));
    saveKanbanState({ ...state, tasks: nextTasks });
    active.persistTimer = null;
  }, 150);
}

function persistKanbanTaskImmediately(taskId) {
  const active = activeKanbanTasks.get(taskId);
  if (!active) return;
  if (active.persistTimer) {
    clearTimeout(active.persistTimer);
    active.persistTimer = null;
  }
  const state = loadKanbanState();
  const nextTasks = state.tasks.map((task) => (
    task.id === taskId ? clone(active.task) : task
  ));
  saveKanbanState({ ...state, tasks: nextTasks });
}

function setActiveKanbanTask(task) {
  const existing = activeKanbanTasks.get(task.id);
  activeKanbanTasks.set(task.id, {
    ...existing,
    task,
  });
  emitKanbanTaskUpdate(task);
  queuePersistKanbanTask(task.id);
}

function updateKanbanTask(taskId, updater, options = {}) {
  const state = loadKanbanState();
  const tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    const nextTask = updater(clone(task));
    activeKanbanTasks.set(taskId, {
      ...(activeKanbanTasks.get(taskId) || {}),
      task: nextTask,
    });
    emitKanbanTaskUpdate(nextTask);
    return nextTask;
  });
  saveKanbanState({ ...state, tasks });
  if (options.refreshActive !== false) {
    const nextTask = tasks.find((task) => task.id === taskId);
    if (nextTask) {
      activeKanbanTasks.set(taskId, {
        ...(activeKanbanTasks.get(taskId) || {}),
        task: nextTask,
      });
    }
  }
  return tasks.find((task) => task.id === taskId) || null;
}

function buildTaskScopedAgentId(taskId, agentId, index = 0) {
  const safeAgentId = String(agentId || `agent-${index}`).replace(/[^a-zA-Z0-9_-]/g, '-');
  return `kanban-${taskId}-${safeAgentId}`;
}

function buildTaskPrompt(task, replyMessage) {
  const taskExecutionPreamble = [
    'You are executing a Kanban task inside a GUI work board.',
    'Treat the provided task as work to perform, not as small talk to mirror back.',
    'Do not merely repeat or lightly paraphrase the task text.',
    'Produce the concrete result of the task, or explain what you did and the outcome.',
  ].join(' ');

  if (!replyMessage) {
    return [
      taskExecutionPreamble,
      `Task:\n${task.prompt}`,
    ].join('\n\n');
  }

  const historyText = (task.runs || [])
    .map((run, index) => {
      const finalReply = stripAnsiAndControl(run.finalResponse || '').trim();
      if (!finalReply) {
        return null;
      }
      return `Run ${index + 1} reply:\n${finalReply}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return [
    taskExecutionPreamble,
    `Original task:\n${task.prompt}`,
    historyText ? `Previous execution history:\n${historyText}` : null,
    `Reviewer feedback:\n${replyMessage}`,
    'Continue the work from this context and address the reviewer feedback directly.',
  ].filter(Boolean).join('\n\n');
}

function buildTaskTranscriptIntro(task, replyMessage) {
  const parts = [
    '> Task prompt',
    replyMessage || task.prompt,
  ];

  if (replyMessage) {
    parts.push('');
    parts.push('> Reviewer feedback');
    parts.push(replyMessage);
  }

  parts.push('');
  return `${parts.join('\n')}\n`;
}

function registerRuntimeTaskGraph(taskId, runtimeGraph) {
  runtimeTaskGraphs.set(taskId, runtimeGraph);
  for (const agent of runtimeGraph.agents || []) {
    taskAgentIndex.set(agent.id, {
      taskId,
      agentName: agent.data?.name || agent.id,
      terminalType: agent.data?.terminalType || agent.data?.cliType || 'claude-code',
    });
  }
}

function unregisterRuntimeTaskGraph(taskId) {
  const runtimeGraph = runtimeTaskGraphs.get(taskId);
  if (runtimeGraph) {
    for (const agent of runtimeGraph.agents || []) {
      taskAgentIndex.delete(agent.id);
      killTrackedPtyById(ptys, ptyDims, agent.id);
    }
  }
  runtimeTaskGraphs.delete(taskId);
}

function createRuntimeGraphForTask(task) {
  if (task.targetType === 'agent') {
    const sharedAgents = sharedAgentManager.loadAgents();
    const baseAgent = sharedAgents.find((agent) => agent.id === task.targetId);
    if (!baseAgent) {
      throw new Error('Assigned agent was not found.');
    }

    const scopedId = buildTaskScopedAgentId(task.id, baseAgent.id);
    return {
      entryAgentId: scopedId,
      agents: [{
        id: scopedId,
        type: 'agentNode',
        position: { x: 160, y: 120 },
        data: {
          ...baseAgent,
          id: scopedId,
          status: 'idle',
        },
      }],
      edges: [],
    };
  }

  const swarm = swarmManager.loadSwarms().find((item) => item.id === task.targetId);
  if (!swarm) {
    throw new Error('Assigned swarm was not found.');
  }

  const idMap = new Map();
  const agents = (swarm.agents || []).map((agent, index) => {
    const scopedId = buildTaskScopedAgentId(task.id, agent.id || index, index);
    idMap.set(agent.id, scopedId);
    return {
      ...clone(agent),
      id: scopedId,
      data: {
        ...clone(agent.data || {}),
        id: scopedId,
        status: 'idle',
      },
    };
  });

  const edges = (swarm.edges || []).map((edge) => ({
    ...clone(edge),
    id: buildTaskScopedAgentId(task.id, edge.id || `${edge.source}-${edge.target}`),
    source: idMap.get(edge.source),
    target: idMap.get(edge.target),
  }));

  const entryAgentId = idMap.get(task.entryAgentId) || agents[0]?.id;
  if (!entryAgentId) {
    throw new Error('Assigned swarm does not have an entry agent.');
  }

  return { agents, edges, entryAgentId };
}

function appendKanbanSegment(agentId, text) {
  const taskInfo = taskAgentIndex.get(agentId);
  if (!taskInfo || !text) return;
  if (taskInfo.terminalType === 'codex') return;

  const active = activeKanbanTasks.get(taskInfo.taskId);
  if (!active?.task) return;

  const task = clone(active.task);
  const run = task.runs.find((item) => item.id === task.currentRunId);
  if (!run) return;

  run.transcript = `${run.transcript || ''}${text}`;

  const lastSegment = run.segments[run.segments.length - 1];
  if (lastSegment && lastSegment.agentId === agentId) {
    lastSegment.text += text;
    lastSegment.updatedAt = new Date().toISOString();
  } else {
    run.segments.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      agentName: taskInfo.agentName,
      text,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  active.task = task;
  emitKanbanTaskUpdate(task);
  queuePersistKanbanTask(task.id);
}

function appendKanbanTimelineEvent(taskId, runId, event) {
  if (!event) return;

  const active = activeKanbanTasks.get(taskId);
  if (!active?.task) return;

  const task = clone(active.task);
  const run = task.runs.find((item) => item.id === runId);
  if (!run) return;

  run.timelineEvents = run.timelineEvents || [];
  run.timelineEvents.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: event.kind || 'assistant',
    phase: event.phase || 'completed',
    title: stripAnsiAndControl(event.title || '').trim() || 'Update',
    text: stripAnsiAndControl(event.text || '').trim(),
    exitCode: Number.isInteger(event.exitCode) ? event.exitCode : null,
    createdAt: new Date().toISOString(),
  });

  active.task = task;
  emitKanbanTaskUpdate(task);
  queuePersistKanbanTask(task.id);
}

function createKanbanTimelineEvent(event = {}) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: event.kind || 'assistant',
    phase: event.phase || 'completed',
    title: stripAnsiAndControl(event.title || '').trim() || 'Update',
    text: stripAnsiAndControl(event.text || '').trim(),
    exitCode: Number.isInteger(event.exitCode) ? event.exitCode : null,
    createdAt: new Date().toISOString(),
  };
}

function appendKanbanTaskAgentTimelineEvent(agentId, event) {
  const taskInfo = taskAgentIndex.get(agentId);
  if (!taskInfo) return;

  const active = activeKanbanTasks.get(taskInfo.taskId);
  const runId = active?.task?.currentRunId;
  if (!runId) return;

  appendKanbanTimelineEvent(taskInfo.taskId, runId, {
    ...event,
    title: `${taskInfo.agentName}: ${event.title || 'Update'}`,
  });
}

async function runKanbanTask(taskId, replyMessage = '') {
  const state = loadKanbanState();
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new Error('Task not found.');
  }
  if (task.runStatus === 'running') {
    return task;
  }

  const runtimeGraph = createRuntimeGraphForTask(task);
  const entryAgent = runtimeGraph.agents?.find((agent) => agent.id === runtimeGraph.entryAgentId) || null;
  const entryTerminalType = entryAgent?.data?.terminalType || entryAgent?.data?.cliType || 'claude-code';
  const useTimelineRender = entryTerminalType !== 'shell' && entryTerminalType !== 'empty';
  unregisterRuntimeTaskGraph(taskId);
  registerRuntimeTaskGraph(taskId, runtimeGraph);

  const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nextPrompt = buildTaskPrompt(task, replyMessage);
  const activeTask = updateKanbanTask(taskId, (currentTask) => {
    currentTask.stage = 'in_progress';
    currentTask.runStatus = 'running';
    currentTask.lastError = null;
    currentTask.currentRunId = runId;
    currentTask.updatedAt = new Date().toISOString();
    currentTask.history = currentTask.history || [];
    currentTask.history.push({
      id: `${runId}-prompt`,
      type: replyMessage ? 'review-reply' : 'prompt',
      text: replyMessage || currentTask.prompt,
      createdAt: new Date().toISOString(),
    });
    currentTask.runs = currentTask.runs || [];
    currentTask.runs.push({
      id: runId,
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: 'running',
      prompt: nextPrompt,
      displayPrompt: replyMessage || currentTask.prompt,
      renderMode: useTimelineRender ? 'timeline' : 'terminal',
      reply: replyMessage,
      finalResponse: '',
      transcript: useTimelineRender ? '' : buildTaskTranscriptIntro(currentTask, replyMessage),
      timelineEvents: useTimelineRender ? [createKanbanTimelineEvent({
        kind: 'command',
        phase: 'running',
        title: 'Task Started',
        text: replyMessage || currentTask.prompt,
      })] : [],
      segments: [],
    });
    return currentTask;
  });
  setActiveKanbanTask(activeTask);

  try {
    if (entryTerminalType !== 'coding-agent') {
      await ensureAgentPtyRunning(runtimeGraph.entryAgentId);
      await waitForAgentPtyReady(runtimeGraph.entryAgentId);
    }
    const execution = await getAgentResponse(runtimeGraph.entryAgentId, nextPrompt, {
      onCodexEvent: entryTerminalType === 'codex'
        ? (event) => appendKanbanTimelineEvent(taskId, runId, event)
        : null,
    });
    const response = execution?.response || '';
    const capturedTranscript = execution?.transcript || '';
    if (execution?.error && !response) {
      throw new Error(execution.error);
    }
    if ((!response || response === '(no response)') && capturedTranscript && /\[error\]/i.test(capturedTranscript)) {
      const transcriptError = capturedTranscript
        .split('\n')
        .filter((line) => /\[error\]/i.test(line))
        .pop()
        ?.replace(/^\[error\]\s*/i, '')
        .trim();
      throw new Error(transcriptError || 'Task failed before producing a final response.');
    }
    const completedTask = updateKanbanTask(taskId, (currentTask) => {
      currentTask.stage = 'in_review';
      currentTask.runStatus = 'awaiting_review';
      currentTask.updatedAt = new Date().toISOString();
      currentTask.currentRunId = null;
      currentTask.history.push({
        id: `${runId}-result`,
        type: 'result',
        text: response || '',
        createdAt: new Date().toISOString(),
      });
      const run = currentTask.runs.find((item) => item.id === runId);
      if (run) {
        run.completedAt = new Date().toISOString();
        run.status = 'success';
        run.finalResponse = response || '';
        if (capturedTranscript && !(run.transcript || '').includes(capturedTranscript)) {
          run.transcript = `${run.transcript || ''}${capturedTranscript}`;
        }
        run.timelineEvents = run.timelineEvents || [];
        if (useTimelineRender && response) {
          run.timelineEvents.push(createKanbanTimelineEvent({
            kind: 'assistant',
            phase: 'completed',
            title: 'Reply',
            text: response,
          }));
        }
        const transcript = run.transcript || '';
        const transcriptBody = transcript.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, '').trim();
        if ((!transcriptBody || transcriptBody === `> Task prompt\n${run.prompt}`) && response) {
          run.transcript = `${transcript}\u001b[32m${response}\u001b[0m\r\n`;
        }
      }
      return currentTask;
    });
    setActiveKanbanTask(completedTask);
    persistKanbanTaskImmediately(taskId);
    return completedTask;
  } catch (err) {
    const failedTask = updateKanbanTask(taskId, (currentTask) => {
      currentTask.stage = 'in_progress';
      currentTask.runStatus = 'error';
      currentTask.lastError = err.message || String(err);
      currentTask.currentRunId = null;
      currentTask.updatedAt = new Date().toISOString();
      const run = currentTask.runs.find((item) => item.id === runId);
      if (run) {
        run.completedAt = new Date().toISOString();
        run.status = 'error';
        run.finalResponse = '';
        run.timelineEvents = run.timelineEvents || [];
        if (useTimelineRender) {
          run.timelineEvents.push(createKanbanTimelineEvent({
            kind: 'error',
            phase: 'completed',
            title: 'Error',
            text: err.message || String(err),
            exitCode: null,
          }));
        }
        run.transcript = `${run.transcript || ''}\u001b[31m[Task failed] ${err.message || String(err)}\u001b[0m\r\n`;
      }
      return currentTask;
    });
    setActiveKanbanTask(failedTask);
    persistKanbanTaskImmediately(taskId);
    throw err;
  } finally {
    unregisterRuntimeTaskGraph(taskId);
  }
}

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  // Fix preload path for production
  const preloadPath = isDev
    ? path.join(__dirname, 'preload.js')
    : path.join(process.resourcesPath, 'app.asar', 'src', 'main', 'preload.js');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  });

  orchestrator = new AgentOrchestrator(mainWindow);

  // Auto-load config from env
  if (process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY) {
    orchestrator.configure({
      authToken: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
    });
  }

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, dist is at the app root level
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html')
      : path.join(__dirname, '../../dist/index.html');
    mainWindow.loadFile(indexPath);
  }
}

app.whenReady().then(async () => {
  settings = loadSettings();
  workspace = settings.workspace || null;
  const storedAuth = readSecureAuthSettings(settings);
  authConfig.authToken = storedAuth.authToken || authConfig.authToken;
  authConfig.baseURL = storedAuth.baseURL || authConfig.baseURL;

  if (storedAuth.shouldMigrateLegacy) {
    writeSecureAuthSettings(settings, storedAuth.authToken, storedAuth.baseURL);
    saveSettings(settings);
  }

  // Initialize graph config manager with workspace
  if (workspace) {
    graphConfigManager.setWorkspace(workspace);
    swarmManager.setWorkspace(workspace);
    sharedAgentManager.setWorkspace(workspace);
    kanbanManager.setWorkspace(workspace);
    templateManager.setWorkspace(workspace);
  }

  await startBridgeServer(); // wait for port to be assigned before any PTY spawning

  // Initialize Whisper manager
  whisperManager = new WhisperManager();
  whisperManager.initialize();

  log('Packaged file logging initialized');
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  for (const ptyProcess of ptys.values()) {
    try { ptyProcess.kill(); } catch {}
  }
  ptys.clear();
});

// ---- IPC Handlers ----

// Configure auth token and base URL at runtime
ipcMain.handle('configure', async (event, { authToken, baseURL }) => {
  const normalizedAuthToken = normalizeOptionalString(authToken);
  const normalizedBaseURL = validateBaseURL(baseURL);

  authConfig = {
    authToken: normalizedAuthToken,
    baseURL: normalizedBaseURL,
  };
  writeSecureAuthSettings(settings, normalizedAuthToken, normalizedBaseURL);
  saveSettings(settings);
  orchestrator.configure({
    authToken: normalizedAuthToken,
    baseURL: normalizedBaseURL,
  });
  return { success: true };
});

// Workspace
ipcMain.handle('get-workspace', () => workspace);

ipcMain.handle('set-workspace', (event, { workspacePath }) => {
  const validatedWorkspacePath = validateWorkspacePath(workspacePath);

  workspace = validatedWorkspacePath;
  settings.workspace = validatedWorkspacePath;
  saveSettings(settings);
  graphConfigManager.setWorkspace(validatedWorkspacePath);
  swarmManager.setWorkspace(validatedWorkspacePath);
  sharedAgentManager.setWorkspace(validatedWorkspacePath);
  kanbanManager.setWorkspace(validatedWorkspacePath);
  templateManager.setWorkspace(validatedWorkspacePath);
  return { success: true };
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Workspace Folder',
    buttonLabel: 'Set as Workspace',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('is-configured', async () => {
  return orchestrator.isConfigured();
});

// Load graph config from workspace
ipcMain.handle('load-graph-config', async () => {
  return graphConfigManager.loadGraphConfig();
});

ipcMain.handle('load-swarms', async () => {
  return swarmManager.loadSwarms();
});

ipcMain.handle('save-swarm', async (event, swarm) => {
  return swarmManager.saveSwarm(swarm);
});

ipcMain.handle('delete-swarm', async (event, id) => {
  return swarmManager.deleteSwarm(id);
});

ipcMain.handle('get-selected-swarm', async () => {
  return swarmManager.getSelectedSwarmId();
});

ipcMain.handle('set-selected-swarm', async (event, id) => {
  return swarmManager.setSelectedSwarmId(id);
});

ipcMain.handle('load-shared-agents', async () => {
  return sharedAgentManager.loadAgents();
});

ipcMain.handle('save-shared-agent', async (event, agent) => {
  return sharedAgentManager.saveAgent(agent);
});

ipcMain.handle('delete-shared-agent', async (event, id) => {
  return sharedAgentManager.deleteAgent(id);
});

ipcMain.handle('load-kanban-state', async () => {
  return loadKanbanState();
});

ipcMain.handle('save-kanban-state', async (event, state) => {
  return saveKanbanState(state);
});

ipcMain.handle('kanban-start-task', async (event, { taskId, replyMessage }) => {
  return runKanbanTask(taskId, replyMessage || '');
});

ipcMain.handle('kanban-delete-task', async (event, { taskId }) => {
  const currentState = loadKanbanState();
  const task = currentState.tasks.find((item) => item.id === taskId);
  if (task?.runStatus === 'running') {
    throw new Error('Cannot delete a running task.');
  }
  unregisterRuntimeTaskGraph(taskId);
  activeKanbanTasks.delete(taskId);
  const nextState = {
    ...currentState,
    tasks: currentState.tasks.filter((item) => item.id !== taskId),
  };
  saveKanbanState(nextState);
  return { success: true };
});

// Mux template management
ipcMain.handle('load-mux-templates', async () => {
  return templateManager.loadTemplates();
});

ipcMain.handle('save-mux-template', async (event, template) => {
  return templateManager.saveTemplate(template);
});

ipcMain.handle('delete-mux-template', async (event, id) => {
  return templateManager.deleteTemplate(id);
});

ipcMain.handle('get-selected-mux-template', async () => {
  return templateManager.getSelectedTemplateId();
});

ipcMain.handle('set-selected-mux-template', async (event, id) => {
  return templateManager.setSelectedTemplateId(id);
});

ipcMain.handle('get-mux-ui-state', async () => {
  return templateManager.getUiState();
});

ipcMain.handle('set-mux-ui-state', async (event, state) => {
  return templateManager.saveUiState(state);
});


// Sync agent configs and edges from renderer
ipcMain.handle('sync-agents', async (event, { agents, edges }) => {
  agentGraph = syncAgentsAndRespawn({
    agentGraph,
    agents,
    edges,
    orchestrator,
    graphConfigManager,
    ptys,
    ptyDims,
    spawnPty,
  });
  return { success: true };
});

// Send user message to an agent
ipcMain.handle('send-message', async (event, { agentId, message }) => {
  orchestrator.sendToAgent(agentId, message);
  return { success: true };
});

// Clear conversation history
ipcMain.handle('clear-history', async (event, { agentId }) => {
  if (agentId) {
    orchestrator.clearHistory(agentId);
  } else {
    orchestrator.clearAllHistory();
  }
  return { success: true };
});

// ---- PTY Handlers ----

function spawnPty(agentId, agentData, cols = 80, rows = 24) {
  console.log(`[PTY] spawnPty called for ${agentId} (terminalType=${agentData?.terminalType || agentData?.cliType || 'claude-code'})`);

  killTrackedPty(ptys, ptyDims, agentId);

  const env = buildPtyEnvironment();

  const { terminalType, command, args } = buildTerminalCommand(agentData, {
    codingAgentConfigPath: path.join(os.homedir(), '.dorchestrator', 'coding-agent', 'config', 'agents.json'),
    codingAgentAgentId: agentData?.id,
    logPrefix: '[PTY]',
    logId: agentId,
  });
  const cleanupMcp = prepareAgentMcpSession(agentId, terminalType, command, args, env, '[PTY]');

  try {
    spawnTrackedPty({
      ptyId: agentId,
      command,
      args,
      cols,
      rows,
      env,
      ptyMap: ptys,
      dimsMap: ptyDims,
      idKey: 'agentId',
      dataChannel: 'pty-data',
      exitChannel: 'pty-exit',
      logPrefix: '[PTY]',
      onData: (data) => forwardAgentPtyData(agentId, data),
      onExit: (exitCode, { isCurrent }) => {
        if (isCurrent) cleanupMcp();
      },
    });
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('pty-started', { agentId });
    }
    return { success: true };
  } catch (err) {
    cleanupMcp();
    console.error('[PTY] Failed to spawn:', err.message);
    console.error('[PTY] Command:', command, args);
    return { success: false, error: err.message };
  }
}

ipcMain.handle('pty-spawn', async (event, { agentId, agentData, cols, rows }) => {
  console.log(`[IPC] pty-spawn received for ${agentId} (${cols || 80}x${rows || 24})`);
  return spawnPty(agentId, agentData, cols, rows);
});

// Fire-and-forget: use ipcMain.on for low-latency input forwarding
ipcMain.on('pty-input', (event, { agentId, data }) => {
  const ptyProcess = ptys.get(agentId);
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.handle('pty-resize', async (event, { agentId, cols, rows }) => {
  resizeTrackedPty(ptys, ptyDims, agentId, cols, rows, true);
  return { success: true };
});

ipcMain.handle('pty-kill', async (event, { agentId }) => {
  killTrackedPtyById(ptys, ptyDims, agentId);
  return { success: true };
});

ipcMain.handle('list-running-agents', async () => {
  return Array.from(ptys.keys());
});

// Mux PTY management
ipcMain.handle('mux-pty-spawn', async (event, { terminalId, config, cols, rows }) => {
  console.log(`[MuxPTY] Spawning terminal ${terminalId} (${cols || 80}x${rows || 24}, terminalType=${config?.terminalType || config?.cliType || 'claude-code'})`);

  killTrackedPty(muxPtys, muxPtyDims, terminalId);

  const env = buildPtyEnvironment();

  const { command, args } = buildTerminalCommand(config, {
    codingAgentConfigPath: path.join(os.homedir(), '.dorchestrator', 'coding-agent', 'config', 'agents.json'),
    allowShell: true,
    logPrefix: '[MuxPTY]',
    logId: terminalId,
  });

  try {
    spawnTrackedPty({
      ptyId: terminalId,
      command,
      args,
      cols,
      rows,
      env,
      ptyMap: muxPtys,
      dimsMap: muxPtyDims,
      idKey: 'terminalId',
      dataChannel: 'mux-pty-data',
      exitChannel: 'mux-pty-exit',
      logPrefix: '[MuxPTY]',
      onExit: (exitCode) => {
        console.log(`[MuxPTY] Terminal ${terminalId} exited with code ${exitCode}`);
      },
    });
    return { success: true };
  } catch (err) {
    console.error('[MuxPTY] Failed to spawn:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.on('mux-pty-input', (event, { terminalId, data }) => {
  const ptyProcess = muxPtys.get(terminalId);
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});
ipcMain.handle('mux-pty-resize', async (event, { terminalId, cols, rows }) => {
  resizeTrackedPty(muxPtys, muxPtyDims, terminalId, cols, rows, false);
  return { success: true };
});

ipcMain.handle('mux-pty-kill', async (event, { terminalId }) => {
  killTrackedPtyById(muxPtys, muxPtyDims, terminalId);
  return { success: true };
});


ipcMain.handle('open-log-file', async () => {
  const { shell } = require('electron');
  shell.openPath(logFile);
  return { success: true, path: logFile };
});
