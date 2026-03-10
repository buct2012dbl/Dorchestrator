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

const NODE_PATH = findNode();

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
      console.log(`[Bridge] ${fromAgentId} → ${targetAgentId}: ${message.slice(0, 80)}`);

      const fromAgent = agentGraph.agents.find((a) => a.id === fromAgentId);
      const fromName = fromAgent?.data?.name || fromAgentId;

      try {
        // Write message to Programmer's active PTY — appears naturally at the > prompt
        const fullMessage = `[Message from ${fromName}]: ${message}`;
        const response = await getAgentResponse(targetAgentId, fullMessage);

        console.log(`[Bridge] Response captured (${response.length} chars), returning to ${fromAgentId}`);
        socket.write(JSON.stringify({ success: true, response }) + '\n');
      } catch (err) {
        console.error('[Bridge] getAgentResponse threw:', err.message);
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

    let captured = '';
    let idleTimer = null;
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      if (idleTimer) clearTimeout(idleTimer);
      if (disposable) disposable.dispose();
      // Strip ANSI escape codes for clean text back to CEO
      const clean = captured
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b[()][0-9A-Za-z]/g, '')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
      console.log(`[Bridge] PTY capture done, ${clean.length} chars`);
      resolve(clean || '(no response)');
    };

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(finish, 6000); // 6s idle = response complete
    };

    // Attach a secondary onData listener to capture Programmer's response
    const disposable = ptyProcess.onData((data) => {
      captured += data;
      resetIdle();
    });

    // Write message to PTY stdin — appears naturally at the > prompt
    ptyProcess.write(message + '\r');
    resetIdle();

    // Safety timeout: 3 minutes
    setTimeout(finish, 180000);
  });
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
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
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

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(async () => {
  settings = loadSettings();
  workspace = settings.workspace || null;
  authConfig.authToken = settings.authToken || authConfig.authToken;
  authConfig.baseURL = settings.baseURL || authConfig.baseURL;
  await startBridgeServer(); // wait for port to be assigned before any PTY spawning

  // Initialize Whisper manager
  whisperManager = new WhisperManager();
  whisperManager.initialize();

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

// Sync agent configs and edges from renderer
ipcMain.handle('sync-agents', async (event, { agents, edges }) => {
  const prevEdges = JSON.stringify(agentGraph.edges);
  agentGraph = { agents, edges };
  orchestrator.syncAgents(agents);
  orchestrator.syncEdges(edges);

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
  };
  if (authConfig.authToken) env.ANTHROPIC_API_KEY = authConfig.authToken;
  if (authConfig.baseURL) env.ANTHROPIC_BASE_URL = authConfig.baseURL;

  const args = ['--dangerously-skip-permissions'];
  if (agentData?.model) args.push('--model', agentData.model);
  if (agentData?.systemPrompt) {
    args.push('--append-system-prompt', agentData.systemPrompt);
    console.log(`[PTY] Setting system prompt for ${agentId}: "${agentData.systemPrompt}"`);
  }
  if (agentData?.name) {
    console.log(`[PTY] Agent name: ${agentData.name}`);
  }

  // Write MCP config for inter-agent messaging if bridge is ready
  const tmpDir = os.tmpdir();
  if (bridgePort > 0) {
    const connectedAgents = getConnectedAgents(agentId);
    if (connectedAgents.length > 0) {
      const mcpBridgePath = path.join(__dirname, 'mcp-bridge.js');

      // Write bridge config (avoids env var passing issues with claude CLI)
      const bridgeConfigPath = path.join(tmpDir, `ao-bridge-cfg-${agentId}.json`);
      const bridgeConfig = { agentId, bridgePort, connectedAgents };
      try {
        fs.writeFileSync(bridgeConfigPath, JSON.stringify(bridgeConfig));
        console.log(`[PTY] Wrote bridge config for ${agentId}: ${bridgeConfigPath}`);
      } catch (err) {
        console.error('[PTY] Failed to write bridge config:', err.message);
      }

      // Write MCP server config pointing to the bridge script
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

  // Find claude: prefer the one in PATH, fall back to known locations
  const claudePath = process.env.CLAUDE_PATH || 'claude';

  try {
    const ptyProcess = pty.spawn(claudePath, args, {
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
