const { spawn } = require('child_process');
const os = require('os');
const { execSync } = require('child_process');

class ClaudeTerminalManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.processes = new Map(); // agentId -> { process }
    this.claudePath = this.findClaude();
  }

  findClaude() {
    try {
      // Try to find claude in PATH using shell
      const shell = process.env.SHELL || '/bin/bash';
      const result = execSync(`${shell} -l -c "which claude"`, { encoding: 'utf8' });
      return result.trim();
    } catch (err) {
      console.error('[ClaudeManager] Could not find claude command:', err.message);
      return 'claude'; // Fallback to just 'claude'
    }
  }

  emit(event, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(event, data);
    }
  }

  spawnClaude(agentId, agentConfig) {
    if (this.processes.has(agentId)) {
      console.log('[ClaudeManager] Agent already running:', agentId);
      return;
    }

    console.log('[ClaudeManager] Spawning claude for agent:', agentId);

    // Build custom agent definition
    const agentName = agentConfig.role.toLowerCase().replace(/\s+/g, '-');
    const agentDef = {
      [agentName]: {
        description: agentConfig.description,
        prompt: agentConfig.systemPrompt || `You are ${agentConfig.role}.`,
      }
    };

    // Build command - use append-system-prompt instead of custom agents
    const systemPrompt = agentConfig.systemPrompt || `You are ${agentConfig.role}. ${agentConfig.description}`;

    const args = [
      '--model', agentConfig.model || 'claude-sonnet-4-6',
      '--append-system-prompt', systemPrompt,
    ];

    console.log('[ClaudeManager] Spawning:', this.claudePath, args);

    try {
      // Use script command to create a pseudo-TTY
      const shell = process.env.SHELL || '/bin/bash';

      // Build the full claude command
      const claudeCmd = `${this.claudePath} ${args.map(a => {
        // Escape single quotes in arguments
        return `'${a.replace(/'/g, "'\\''")}'`;
      }).join(' ')}`;

      // Use script -q to run in a PTY without recording
      const scriptArgs = ['-q', '/dev/null', shell, '-l', '-c', claudeCmd];

      const proc = spawn('script', scriptArgs, {
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
          ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
          TERM: 'xterm-256color',
        },
        cwd: process.cwd(),
      });

      this.processes.set(agentId, { process: proc });

      proc.stdout.on('data', (data) => {
        this.emit('terminal-output', { agentId, data: data.toString() });
      });

      proc.stderr.on('data', (data) => {
        this.emit('terminal-output', { agentId, data: data.toString() });
      });

      proc.on('exit', (code) => {
        console.log('[ClaudeManager] Claude process exited for', agentId, 'code:', code);
        this.processes.delete(agentId);
        this.emit('terminal-exit', { agentId, code });
      });

      proc.on('error', (err) => {
        console.error('[ClaudeManager] Process error:', err);
        this.emit('terminal-error', { agentId, error: err.message });
      });
    } catch (err) {
      console.error('[ClaudeManager] Failed to spawn:', err);
      this.emit('terminal-error', { agentId, error: err.message });
    }
  }

  writeToAgent(agentId, input) {
    const proc = this.processes.get(agentId);
    if (proc && proc.process.stdin) {
      proc.process.stdin.write(input);
    } else {
      console.warn('[ClaudeManager] No process for agent:', agentId);
    }
  }

  killAgent(agentId) {
    const proc = this.processes.get(agentId);
    if (proc) {
      proc.process.kill();
      this.processes.delete(agentId);
    }
  }

  killAll() {
    for (const [agentId, proc] of this.processes.entries()) {
      proc.process.kill();
    }
    this.processes.clear();
  }
}

module.exports = { ClaudeTerminalManager };
