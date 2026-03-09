# Dorchestrator

![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Electron](https://img.shields.io/badge/electron-28.0.0-blue)
![React](https://img.shields.io/badge/react-18.2.0-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

A visual desktop application for orchestrating multiple Claude AI agents with real-time collaboration and inter-agent communication.

![Agent Orchestrator](https://img.shields.io/badge/status-active-success)

## ✨ Features

### 🎨 Visual Agent Graph
- **Drag-and-drop interface** powered by React Flow
- **Real-time node connections** for defining agent relationships
- **Color-coded agents** with customizable roles and templates
- **Interactive canvas** with zoom, pan, and selection controls

### 💻 Integrated Terminals
- **Live PTY sessions** for each agent using `claude` CLI
- **xterm.js terminals** with full ANSI color support
- **Auto-restart** on session end
- **Flexible layouts** (auto, 1-col, 2-col, 3-col grid)
- **Toggle views** to focus on graph or terminals

### 🤝 Inter-Agent Communication
- **MCP-based messaging** between connected agents
- **TCP bridge server** for reliable message routing
- **Two-way communication** with response capture
- **Real-time streaming** of agent responses
- **Edge-aware tool discovery** (agents only see connected peers)

### ⚙️ Agent Configuration
- **Pre-built templates**: CEO, Programmer, Designer, Tester, DevOps
- **Custom agents** with user-defined behavior
- **Model selection**: Opus 4.6, Sonnet 4.6, Haiku 4.5
- **System prompts** for role-specific instructions
- **Persistent settings** across sessions

### 📁 Workspace Management
- **Folder-based workspaces** for agent file access
- **Launch-time workspace picker** (blocks until set)
- **Change workspace** on-the-fly from header
- **Shared working directory** for all agents

## 🚀 Quick Start

### Prerequisites
- macOS (Darwin)
- Node.js 16+
- `claude` CLI installed and in PATH ([get it here](https://github.com/anthropics/claude-code))
- Anthropic API key

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd agent-orchestrator

# Install dependencies
npm install

# The postinstall script will automatically rebuild node-pty for Electron
```

### Configuration

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_BASE_URL=https://api.anthropic.com  # optional
CLAUDE_PATH=/path/to/claude  # optional, defaults to 'claude' in PATH
```

Or configure via the UI after launch (Settings button in header).

### Development

```bash
# Start in development mode (hot reload)
npm run dev
```

This runs:
- Vite dev server on `http://localhost:3000`
- Electron app with DevTools open

### Production Build

```bash
# Build and package the app
npm run build
```

The packaged app will be in the `dist/` directory.

## 🏗️ Architecture

### Tech Stack
- **Electron** - Desktop app framework
- **React** - UI components and state management
- **React Flow** - Graph visualization and interaction
- **xterm.js** - Terminal emulation with PTY support
- **node-pty** - Pseudo-terminal spawning (native addon)
- **Anthropic SDK** - Fallback orchestrator (not used for PTY mode)

### Key Components

#### Main Process (`src/main/index.js`)
- PTY lifecycle management (spawn, resize, kill)
- TCP bridge server for inter-agent messaging
- MCP config generation per agent
- Workspace and auth settings persistence
- IPC handlers for renderer communication

#### MCP Bridge (`src/main/mcp-bridge.js`)
- Stdio MCP server (newline-delimited JSON)
- Exposes `send_message` tool to connected agents
- Handles `initialize`, `tools/list`, `tools/call`
- Forwards messages via TCP to bridge server

#### Renderer Process (`src/renderer/`)
- **App.jsx** - Main layout, workspace picker, view toggles
- **GraphView** - React Flow canvas with agent nodes
- **TerminalGrid** - Multi-terminal layout manager
- **TerminalPanel** - Individual xterm.js terminal + PTY integration
- **AgentConfigPanel** - Agent settings sidebar

### Inter-Agent Communication Flow

```
CEO Terminal (PTY)
  ↓ uses MCP tool: send_message
MCP Bridge (stdio)
  ↓ TCP socket
Bridge Server (main process)
  ↓ spawns claude --print
Programmer Terminal (PTY)
  ↓ captures output
Bridge Server
  ↓ returns response
CEO Terminal (receives reply)
```

## 📖 Usage

### Creating Agents
1. Click "Add Agent" in the graph view
2. Select a template (CEO, Programmer, etc.) or create custom
3. Configure name, role, model, and system prompt
4. Click "Save"

### Connecting Agents
1. Drag from one agent's handle to another
2. Connected agents can message each other via MCP tools
3. Edges are bidirectional (both agents see each other)

### Messaging Between Agents
In any agent's terminal:
```
> Send a message to the Programmer asking them to create a snake game
```

The agent will use the `send_message` MCP tool automatically if connected.

### Workspace Setup
- On first launch, you'll be prompted to select a workspace folder
- All agents run with this folder as their working directory
- Change workspace anytime via the folder button in the header

### View Controls
- **📊 Graph** - Toggle graph view on/off
- **💻 Terminal** - Toggle terminal view on/off
- **Split handle** - Drag to resize graph/terminal ratio (when both visible)

## 🛠️ Troubleshooting

### "agent-bridge failed" error
- Ensure `claude` CLI is installed and in PATH
- Check that MCP config files are being written (see console logs)
- Verify agents are connected in the graph before messaging

### Terminal not spawning
- Check main process logs: `[PTY] spawnPty called for...`
- Ensure `ANTHROPIC_API_KEY` is set
- Try restarting the app

### node-pty build errors
```bash
# Manually rebuild node-pty for Electron
npx @electron/rebuild -f -w node-pty
```

### No response from target agent
- Check that the target agent's terminal is running (not exited)
- Increase idle timeout in `getAgentResponse()` if responses are slow
- Check bridge server logs: `[Bridge] Response captured...`

## 📝 License

MIT

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude API and CLI
- [React Flow](https://reactflow.dev) for graph visualization
- [xterm.js](https://xtermjs.org) for terminal emulation

