const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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

// Setup logging to file in production
const logFile = path.join(app.getPath('userData'), 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(...args) {
  const message = `[${new Date().toISOString()}] ${args.join(' ')}`;
  console.log(...args);
  if (!app.isPackaged) return;
  logStream.write(message + '\n');
}

// Override console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
console.log = (...args) => {
  originalConsoleLog(...args);
  if (app.isPackaged) logStream.write(`[${new Date().toISOString()}] ${args.join(' ')}\n`);
};
console.error = (...args) => {
  originalConsoleError(...args);
  if (app.isPackaged) logStream.write(`[${new Date().toISOString()}] ERROR: ${args.join(' ')}\n`);
};

log('App starting...');
log('Log file location:', logFile);
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

// ---- Agent graph (kept in sync for PTY spawning) ----
let agentGraph = { agents: [], edges: [] };

function getConnectedAgents(agentId) {
  const { agents, edges } = agentGraph;
  const connected = new Set();
  for (const edge of edges) {
    if (edge.source === agentId) connected.add(edge.target);
    if (edge.target === agentId) connected.add(edge.source);
  }
  return agents
    .filter((a) => connected.has(a.id))
    .map((a) => ({ id: a.id, role: a.data?.role || '', name: a.data?.name || '' }));
}

// ---- TCP bridge server for inter-agent messaging ----
let bridgePort = 0;

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

      const { fromAgentId, targetAgentId, message } = msg;
      console.log(`[Bridge] ${fromAgentId} → ${targetAgentId}: ${message ? message.slice(0, 80) : '(empty message)'}`);

      const fromAgent = agentGraph.agents.find((a) => a.id === fromAgentId);
      const fromName = fromAgent?.data?.name || fromAgentId;

      // Check target agent's terminal type
      const targetAgent = agentGraph.agents.find((a) => a.id === targetAgentId);
      const terminalType = targetAgent?.data?.terminalType || 'claude-code';

      try {
        // Use orchestrator API for Claude Code agents (clean Anthropic API responses)
        if (terminalType === 'claude-code' && orchestrator && orchestrator.isConfigured()) {
          console.log(`[Bridge] Using orchestrator API for Claude Code agent: ${fromAgentId} → ${targetAgentId}`);
          const response = await orchestrator.sendToAgentAndCollect(targetAgentId, message, fromAgentId);

          if (response) {
            console.log(`[Bridge] Response from orchestrator (${response.length} chars), returning to ${fromAgentId}`);
            socket.write(JSON.stringify({ success: true, response }) + '\n');
          } else {
            socket.write(JSON.stringify({ success: false, error: 'No response from agent' }) + '\n');
          }
        } else {
          // Fallback to PTY capture for Codex agents or if orchestrator not configured
          if (terminalType === 'codex') {
            console.log(`[Bridge] Using PTY capture for Codex agent: ${fromAgentId} → ${targetAgentId}`);
          } else {
            console.log(`[Bridge] Fallback to PTY capture (orchestrator not configured): ${fromAgentId} → ${targetAgentId}`);
          }

          const fullMessage = `[Message from ${fromName}]: ${message}`;
          const response = await getAgentResponse(targetAgentId, fullMessage);

          console.log(`[Bridge] Response captured (${response.length} chars), returning to ${fromAgentId}`);
          socket.write(JSON.stringify({ success: true, response }) + '\n');
        }
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
function getAgentResponse(agentId, message) {
  return new Promise((resolve) => {
    const ptyProcess = ptys.get(agentId);
    if (!ptyProcess) {
      resolve('(agent not running)');
      return;
    }

    // Find the target agent to check its terminal type
    const targetAgent = agentGraph.agents.find((a) => a.id === agentId);
    const terminalType = targetAgent?.data?.terminalType || 'claude-code';

    // For Codex agents, use exec command to process the message
    if (terminalType === 'codex') {
      console.log(`[Bridge] Codex agent detected - spawning exec command for: ${message}`);

      // Show incoming message in terminal
      ptyProcess.write(`\r\n\x1b[36m[Incoming message]\x1b[0m ${message}\r\n\r\n`);

      const codexPath = process.env.CODEX_PATH || 'codex';
      const args = ['exec', '--full-auto', '--skip-git-repo-check'];
      if (targetAgent?.data?.model) args.push('--model', targetAgent.data.model);
      if (targetAgent?.data?.systemPrompt) args.push('-c', `instructions=${JSON.stringify(targetAgent.data.systemPrompt)}`);
      args.push(message);

      const { spawn } = require('child_process');
      const execProcess = spawn(codexPath, args, {
        cwd: workspace || process.env.HOME || '/',
        env: process.env,
      });

      let output = '';
      execProcess.stdout.on('data', (data) => {
        output += data.toString();
        // Show exec output in terminal in real-time
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim()) {
            ptyProcess.write(`\x1b[90m${line}\x1b[0m\r\n`);
          }
        }
      });
      execProcess.stderr.on('data', (data) => {
        output += data.toString();
      });

      execProcess.on('close', (code) => {
        ptyProcess.write(`\x1b[36m[Response sent]\x1b[0m\r\n\r\n`);

        const clean = output
          .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
          .replace(/\x1b[()][0-9A-Za-z]/g, '')
          .trim();
        console.log(`[Bridge] Codex exec completed with code ${code}, output: ${clean.slice(0, 200)}...`);
        resolve(clean || '(no response)');
      });

      // Safety timeout
      setTimeout(() => {
        execProcess.kill();
        resolve('(timeout)');
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
      console.log(`[Bridge] Extracted final response: ${finalResponse.slice(0, 200)}...`);

      resolve(finalResponse || '(no response)');
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
    console.log(`[Bridge] Sending message to Claude Code agent ${agentId}: ${message}`);
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

let settings = {};
let workspace = null; // current working directory for PTY sessions

// PTY management
const ptys = new Map();     // agentId -> pty instance
const ptyDims = new Map();  // agentId -> { cols, rows }
let authConfig = {
  authToken: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || null,
  baseURL: process.env.ANTHROPIC_BASE_URL || null,
};

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
  authConfig.authToken = settings.authToken || authConfig.authToken;
  authConfig.baseURL = settings.baseURL || authConfig.baseURL;

  // Initialize graph config manager with workspace
  if (workspace) {
    graphConfigManager.setWorkspace(workspace);
  }

  await startBridgeServer(); // wait for port to be assigned before any PTY spawning

  // Initialize Whisper manager
  whisperManager = new WhisperManager();
  whisperManager.initialize();

  log(`Log file location: ${logFile}`);
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
  authConfig = { authToken, baseURL };
  settings.authToken = authToken;
  settings.baseURL = baseURL;
  saveSettings(settings);
  orchestrator.configure({ authToken, baseURL });
  return { success: true };
});

// Workspace
ipcMain.handle('get-workspace', () => workspace);

ipcMain.handle('set-workspace', (event, { workspacePath }) => {
  workspace = workspacePath;
  settings.workspace = workspacePath;
  saveSettings(settings);
  graphConfigManager.setWorkspace(workspacePath);
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

// Sync agent configs and edges from renderer
ipcMain.handle('sync-agents', async (event, { agents, edges }) => {
  const prevEdges = JSON.stringify(agentGraph.edges);
  agentGraph = { agents, edges };
  orchestrator.syncAgents(agents);
  orchestrator.syncEdges(edges);

  // Save to workspace config
  graphConfigManager.saveGraphConfig(agents, edges);

  // If edges changed, respawn affected PTYs so they get the updated MCP tool list
  if (JSON.stringify(edges) !== prevEdges) {
    for (const agent of agents) {
      if (ptys.has(agent.id)) {
        const dims = ptyDims.get(agent.id) || { cols: 80, rows: 24 };
        spawnPty(agent.id, agent.data, dims.cols, dims.rows);
      }
    }
  }

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
  console.log(`[PTY] spawnPty called for ${agentId}, agentData:`, JSON.stringify(agentData, null, 2));

  // Kill existing session if any
  if (ptys.has(agentId)) {
    try { ptys.get(agentId).kill(); } catch {}
    ptys.delete(agentId);
  }

  const env = {
    ...process.env,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    LANG: process.env.LANG || 'en_US.UTF-8',
    PATH: `${path.dirname(NODE_PATH)}:${process.env.PATH || '/usr/local/bin:/usr/bin:/bin'}`,
  };
  if (authConfig.authToken) env.ANTHROPIC_API_KEY = authConfig.authToken;
  if (authConfig.baseURL) env.ANTHROPIC_BASE_URL = authConfig.baseURL;

  const terminalType = agentData?.terminalType || 'claude-code';

  let command, args;

  if (terminalType === 'codex') {
    // OpenAI Codex CLI
    command = process.env.CODEX_PATH || 'codex';
    args = ['--full-auto'];
    if (agentData?.model) args.push('--model', agentData.model);
    if (agentData?.systemPrompt) args.push('-c', `instructions=${JSON.stringify(agentData.systemPrompt)}`);
    if (agentData?.name) {
      console.log(`[PTY] Codex agent name: ${agentData.name}`);
    }
  } else {
    // Claude Code CLI (default)
    command = process.env.CLAUDE_PATH || CLAUDE_PATH;
    args = ['--dangerously-skip-permissions'];
    if (agentData?.model) args.push('--model', agentData.model);
    if (agentData?.systemPrompt) {
      args.push('--append-system-prompt', agentData.systemPrompt);
      console.log(`[PTY] Setting system prompt for ${agentId}: "${agentData.systemPrompt}"`);
    }
    if (agentData?.name) {
      console.log(`[PTY] Agent name: ${agentData.name}`);
    }
  }

  // Write MCP config for inter-agent messaging if bridge is ready (both Claude Code and Codex)
  const tmpDir = os.tmpdir();
  if (bridgePort > 0) {
    const connectedAgents = getConnectedAgents(agentId);
    if (connectedAgents.length > 0) {
      let mcpBridgePath;

      if (app.isPackaged) {
        // In production, copy mcp-bridge.js to temp directory since .asar files can't be executed
        const sourcePath = path.join(process.resourcesPath, 'app.asar', 'src', 'main', 'mcp-bridge.js');
        mcpBridgePath = path.join(tmpDir, 'ao-mcp-bridge.js');

        // Copy if not exists or source is newer
        try {
          if (!fs.existsSync(mcpBridgePath)) {
            const bridgeContent = fs.readFileSync(sourcePath, 'utf8');
            fs.writeFileSync(mcpBridgePath, bridgeContent);
            console.log(`[PTY] Copied MCP bridge to: ${mcpBridgePath}`);
          }
        } catch (err) {
          console.error('[PTY] Failed to copy MCP bridge:', err.message);
        }
      } else {
        mcpBridgePath = path.join(__dirname, 'mcp-bridge.js');
      }

      // Write bridge config (avoids env var passing issues)
      const bridgeConfigPath = path.join(tmpDir, `ao-bridge-cfg-${agentId}.json`);
      const bridgeConfig = { agentId, bridgePort, connectedAgents };
      try {
        fs.writeFileSync(bridgeConfigPath, JSON.stringify(bridgeConfig));
        console.log(`[PTY] Wrote bridge config for ${agentId}: ${bridgeConfigPath}`);
      } catch (err) {
        console.error('[PTY] Failed to write bridge config:', err.message);
      }

      if (terminalType === 'codex') {
        // Codex: dynamically add MCP server before spawning
        // We'll use a unique name per agent to avoid conflicts
        const mcpServerName = `agent-bridge-${agentId}`;

        // First, remove any existing server with this name (cleanup from previous runs)
        try {
          execSync(`${command} mcp remove ${mcpServerName}`, { stdio: 'ignore', timeout: 2000 });
        } catch {}

        // Add the MCP bridge server
        try {
          const addCmd = `${command} mcp add ${mcpServerName} -- ${NODE_PATH} ${mcpBridgePath} ${bridgeConfigPath}`;
          execSync(addCmd, { stdio: 'pipe', timeout: 5000 });
          console.log(`[PTY] Added MCP server for Codex ${agentId}: ${mcpServerName}`);
        } catch (err) {
          console.error('[PTY] Failed to add MCP server for Codex:', err.message);
        }
      } else {
        // Claude Code: use --mcp-config flag
        const mcpConfig = {
          mcpServers: {
            'agent-bridge': {
              command: NODE_PATH,
              args: [mcpBridgePath, bridgeConfigPath],
            },
          },
        };
        const mcpConfigPath = path.join(tmpDir, `ao-mcp-${agentId}.json`);
        try {
          fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig));
          args.push('--mcp-config', mcpConfigPath);
          console.log(`[PTY] Wrote MCP config for ${agentId}: ${mcpConfigPath}`);
        } catch (err) {
          console.error('[PTY] Failed to write MCP config:', err.message);
        }
      }
    }
  }

  try {
    console.log(`[PTY] Spawning: ${command} ${args.join(' ')}`);
    console.log(`[PTY] CWD: ${workspace || process.env.HOME || '/'}`);

    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: workspace || process.env.HOME || '/',
      env,
    });

    ptyProcess.onData((data) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-data', { agentId, data });
      }
    });

    ptyProcess.onExit(({ exitCode }) => {
      console.log(`[PTY] Process exited with code ${exitCode} for agent ${agentId}`);

      // Cleanup MCP server for Codex agents
      if (terminalType === 'codex') {
        const mcpServerName = `agent-bridge-${agentId}`;
        try {
          const codexPath = process.env.CODEX_PATH || 'codex';
          execSync(`${codexPath} mcp remove ${mcpServerName}`, { stdio: 'ignore', timeout: 2000 });
          console.log(`[PTY] Removed MCP server for Codex ${agentId}: ${mcpServerName}`);
        } catch (err) {
          console.log(`[PTY] MCP server cleanup skipped (may not exist): ${err.message}`);
        }
      }

      ptys.delete(agentId);
      ptyDims.delete(agentId);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('pty-exit', { agentId, exitCode });
      }
    });

    ptys.set(agentId, ptyProcess);
    ptyDims.set(agentId, { cols, rows });
    return { success: true };
  } catch (err) {
    console.error('[PTY] Failed to spawn:', err.message);
    console.error('[PTY] Command:', command, args);
    return { success: false, error: err.message };
  }
}

ipcMain.handle('pty-spawn', async (event, { agentId, agentData, cols, rows }) => {
  console.log(`[IPC] pty-spawn received for ${agentId}`, { agentData, cols, rows });
  return spawnPty(agentId, agentData, cols, rows);
});

// Fire-and-forget: use ipcMain.on for low-latency input forwarding
ipcMain.on('pty-input', (event, { agentId, data }) => {
  const ptyProcess = ptys.get(agentId);
  if (ptyProcess) ptyProcess.write(data);
});

ipcMain.handle('pty-resize', async (event, { agentId, cols, rows }) => {
  const ptyProcess = ptys.get(agentId);
  if (ptyProcess) {
    try { ptyProcess.resize(Math.max(1, cols), Math.max(1, rows)); } catch {}
    ptyDims.set(agentId, { cols, rows });
  }
  return { success: true };
});

ipcMain.handle('pty-kill', async (event, { agentId }) => {
  if (ptys.has(agentId)) {
    try { ptys.get(agentId).kill(); } catch {}
    ptys.delete(agentId);
    ptyDims.delete(agentId);
  }
  return { success: true };
});

ipcMain.handle('open-log-file', async () => {
  const { shell } = require('electron');
  shell.openPath(logFile);
  return { success: true, path: logFile };
});
