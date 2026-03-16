import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import type { Orchestrator } from '../core/orchestrator.js';

export async function startRepl(orchestrator: Orchestrator, agentId: string): Promise<void> {
  const rl = readline.createInterface({ input, output });

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

      console.log(chalk.blue('\nAgent: '));

      try {
        await orchestrator.executeTask(agentId, message);
      } catch (error) {
        console.error(chalk.red('❌ Error occurred'));
        throw error;
      }

      console.log('\n');
    } catch (error) {
      console.error(chalk.red('\n❌ Error:'), error);
      console.log();
    }
  }
}
