import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import type { Orchestrator } from '../core/orchestrator.js';

const BRAND_ART = [
  '╔╦╗╔═╗╦═╗╔═╗╦ ╦╔═╗╔═╗╔╦╗╦═╗╔═╗╔╦╗╔═╗╦═╗',
  ' ║║║ ║╠╦╝║  ╠═╣║╣ ╚═╗ ║ ╠╦╝╠═╣ ║ ║ ║╠╦╝',
  '═╩╝╚═╝╩╚═╚═╝╩ ╩╚═╝╚═╝ ╩ ╩╚═╩ ╩ ╩ ╚═╝╩╚═'
].join('\n');

function trimMiddle(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  const head = Math.ceil((maxLength - 1) / 2);
  const tail = Math.floor((maxLength - 2) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
}

function makeStatLine(label: string, value: string): string {
  return `${chalk.hex('#7dd3fc')(label.padEnd(10))}${chalk.white(value)}`;
}

function renderHeader(agentName: string, model: string, workspacePath: string): void {
  const width = output.columns || 100;
  const workspace = trimMiddle(workspacePath, Math.max(36, width - 42));
  const panel = boxen(
    [
      chalk.hex('#8ec5ff').bold(BRAND_ART),
      '',
      chalk.hex('#9fb0c3')('Built-in agent console'),
      chalk.hex('#5b7088')('────────────────────────────────────────'),
      makeStatLine('Agent', agentName),
      makeStatLine('Model', model),
      makeStatLine('Workspace', workspace),
      makeStatLine('Commands', 'exit  stats  clear')
    ].join('\n'),
    {
      padding: { top: 0, right: 1, bottom: 0, left: 1 },
      margin: 0,
      borderStyle: 'round',
      borderColor: 'cyan',
      backgroundColor: '#08111f'
    }
  );

  console.clear();
  console.log(panel);
  console.log(chalk.hex('#5b7088')(' Type a task and press Enter. The agent keeps session context across turns.\n'));
}

function renderPrompt(): string {
  return chalk.hex('#7dd3fc')('› ') + chalk.whiteBright('Prompt') + chalk.hex('#5b7088')('  ');
}

export async function startRepl(orchestrator: Orchestrator, agentId: string): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
    terminal: true
  });

  let intentionalClose = false;

  rl.on('close', () => {
    if (!intentionalClose) {
      console.log(chalk.red('\nReadline closed unexpectedly.'));
      console.log(chalk.gray('This usually means stdin is not attached to a live TTY.'));
    }
    orchestrator.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nUse "exit" or "quit" to leave the session.'));
  });

  const agent = orchestrator.getAgent(agentId);
  const agentName = agent?.config.name || agentId;
  const model = agent?.config.model || 'unknown';
  const workspacePath = process.cwd();

  renderHeader(agentName, model, workspacePath);

  while (true) {
    try {
      const message = await rl.question(renderPrompt());

      if (!message.trim()) continue;

      const normalized = message.toLowerCase();

      if (normalized === 'exit' || normalized === 'quit') {
        console.log(chalk.hex('#fbbf24')('\nSession closed.'));
        intentionalClose = true;
        rl.close();
        orchestrator.shutdown();
        process.exit(0);
      }

      if (normalized === 'stats') {
        const stats = orchestrator.getStats();
        console.log();
        console.log(
          boxen(JSON.stringify(stats, null, 2), {
            padding: { top: 0, right: 1, bottom: 0, left: 1 },
            borderStyle: 'round',
            borderColor: 'blue'
          })
        );
        console.log();
        continue;
      }

      if (normalized === 'clear') {
        renderHeader(agentName, model, workspacePath);
        continue;
      }

      console.log();
      console.log(chalk.hex('#5b7088')('┌─ Built-in Agent'));
      console.log(chalk.hex('#5b7088')('│'));

      rl.pause();

      const spinner = ora({
        text: chalk.dim('Thinking...'),
        color: 'cyan',
        stream: process.stdout,
        discardStdin: false
      }).start();

      try {
        await orchestrator.executeTask(agentId, message, () => {
          spinner.stop();
        });

        process.stdout.write(`\n${chalk.hex('#5b7088')('└────────────────────────────────────────────────────────')}\n\n`);
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error'), error);
        process.stdout.write('\n');
      } finally {
        rl.resume();
        if (input.isTTY && input.setRawMode) {
          input.setRawMode(false);
          input.setRawMode(true);
        }
      }
    } catch (error) {
      console.error(chalk.red('\nError:'), error);
      console.log();
    }
  }
}
