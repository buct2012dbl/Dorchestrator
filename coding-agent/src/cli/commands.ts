import { Command } from 'commander';
import { CodebaseIndexer } from '../context/indexer.js';
import { resolve } from 'node:path';
import chalk from 'chalk';
import ora from 'ora';

const program = new Command();

program
  .name('index')
  .description('Codebase indexing commands');

program
  .command('build')
  .description('Build codebase index')
  .option('-i, --incremental', 'Only index changed files')
  .option('-d, --db <path>', 'Database path', '.coding-agent/index.db')
  .action(async (options) => {
    const spinner = ora('Building codebase index...').start();

    try {
      const dbPath = resolve(process.cwd(), options.db);
      const indexer = new CodebaseIndexer(dbPath, process.cwd());

      const stats = await indexer.buildIndex({
        incremental: options.incremental || false
      });

      spinner.succeed('Index built successfully');

      console.log(chalk.blue('\nIndex Statistics:'));
      console.log(chalk.gray(`  Files indexed: ${stats.filesIndexed}`));
      console.log(chalk.gray(`  Symbols found: ${stats.symbolsFound}`));
      console.log(chalk.gray(`  Dependencies: ${stats.dependenciesFound}`));
      console.log(chalk.gray(`  Duration: ${stats.duration}ms`));

      indexer.close();
    } catch (error) {
      spinner.fail('Failed to build index');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show index statistics')
  .option('-d, --db <path>', 'Database path', '.coding-agent/index.db')
  .action(async (options) => {
    try {
      const dbPath = resolve(process.cwd(), options.db);
      const indexer = new CodebaseIndexer(dbPath, process.cwd());

      const stats = indexer.getStats();

      console.log(chalk.blue('\nIndex Statistics:'));
      console.log(chalk.gray(`  Files indexed: ${stats.filesIndexed}`));
      console.log(chalk.gray(`  Symbols found: ${stats.symbolsFound}`));
      console.log(chalk.gray(`  Dependencies: ${stats.dependenciesFound}`));

      indexer.close();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program
  .command('search <query>')
  .description('Search codebase')
  .option('-l, --limit <number>', 'Maximum results', '20')
  .option('-d, --db <path>', 'Database path', '.coding-agent/index.db')
  .action(async (query, options) => {
    try {
      const dbPath = resolve(process.cwd(), options.db);
      const indexer = new CodebaseIndexer(dbPath, process.cwd());

      const results = await indexer.search(query, {
        limit: parseInt(options.limit)
      });

      console.log(chalk.blue(`\nFound ${results.length} results:\n`));

      for (const result of results) {
        console.log(chalk.bold(result.path));
        console.log(chalk.gray(`  Score: ${result.score.toFixed(2)}`));
        if (result.matches.length > 0) {
          console.log(chalk.gray(`  ${result.matches[0]}`));
        }
        console.log();
      }

      indexer.close();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse();
