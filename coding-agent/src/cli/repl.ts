import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import ora from 'ora';
import type { Orchestrator } from '../core/orchestrator.js';

export async function startRepl(orchestrator: Orchestrator, agentId: string): Promise<void> {
  const rl = readline.createInterface({
    input,
    output,
    terminal: true
  });

  // Track if we're intentionally closing
  let intentionalClose = false;

  // Handle unexpected close
  rl.on('close', () => {
    if (!intentionalClose) {
      console.log(chalk.red('\n⚠️  Readline closed unexpectedly!'));
      console.log(chalk.gray('This usually happens when stdin is not a TTY or gets closed.'));
    }
    orchestrator.shutdown();
    process.exit(0);
  });

  // Prevent SIGINT from closing readline during agent work
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nUse "exit" or "quit" to exit'));
  });

  // Get agent info
  const agent = orchestrator.getAgent(agentId);
  const workspacePath = process.cwd();

  // Display header with context
  console.log(chalk.cyan('━'.repeat(60)));
  console.log(chalk.cyan.bold('  Interactive Mode'));
  console.log(chalk.gray(`  Agent: ${agent?.config.name || agentId}`));
  console.log(chalk.gray(`  Model: ${agent?.config.model || 'unknown'}`));
  console.log(chalk.gray(`  Workspace: ${workspacePath}`));
  console.log(chalk.cyan('━'.repeat(60)));
  console.log(chalk.dim('  Commands: exit, stats, clear\n'));

  while (true) {
    try {
      const message = await rl.question(chalk.green('You: '));

      if (!message.trim()) continue;

      if (message.toLowerCase() === 'exit' || message.toLowerCase() === 'quit') {
        console.log(chalk.yellow('\n👋 Goodbye!'));
        intentionalClose = true;
        rl.close();
        orchestrator.shutdown();
        process.exit(0);
      }

      if (message.toLowerCase() === 'stats') {
        const stats = orchestrator.getStats();
        console.log(chalk.blue('\n📊 System Stats:'));
        console.log(JSON.stringify(stats, null, 2));
        console.log();
        continue;
      }

      if (message.toLowerCase() === 'clear') {
        console.clear();
        // Redisplay header
        console.log(chalk.cyan('━'.repeat(60)));
        console.log(chalk.cyan.bold('  Interactive Mode'));
        console.log(chalk.gray(`  Agent: ${agent?.config.name || agentId}`));
        console.log(chalk.gray(`  Model: ${agent?.config.model || 'unknown'}`));
        console.log(chalk.gray(`  Workspace: ${workspacePath}`));
        console.log(chalk.cyan('━'.repeat(60)));
        console.log(chalk.dim('  Commands: exit, stats, clear\n'));
        continue;
      }

      process.stdout.write(chalk.blue('\nAgent: \n'));

      // Pause readline to prevent interference during agent response
      rl.pause();

      // Show thinking spinner inline
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

        // Force a newline and ensure clean state for next prompt
        process.stdout.write('\n');
      } catch (error) {
        spinner.stop();
        console.error(chalk.red('Error'));
        throw error;
      } finally {
        // Always resume readline, even if there was an error
        rl.resume();
        // Force terminal back to proper state after resume
        if (input.isTTY && input.setRawMode) {
          input.setRawMode(false);
          input.setRawMode(true);
        }
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      console.log();
    }
  }
}
