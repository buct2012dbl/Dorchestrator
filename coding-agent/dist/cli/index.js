#!/usr/bin/env node
import { Command } from 'commander';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configLoader } from '../config/loader.js';
import { Orchestrator } from '../core/orchestrator.js';
import { agentRegistry } from '../core/agent-registry.js';
import { CodingAgent } from '../agent/coding-agent.js';
import { ExplorerAgent } from '../agent/explorer-agent.js';
import { PlannerAgent } from '../agent/planner-agent.js';
import { ReviewerAgent } from '../agent/reviewer-agent.js';
import { providerRegistry } from '../llm/provider.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { readTool, writeTool, editTool, globTool, grepTool } from '../tools/file-tools.js';
import { bashTool } from '../tools/bash-tool.js';
import { searchCodeTool, getDependenciesTool, findSymbolTool, indexCodebaseTool } from '../tools/context-tools.js';
import { sendMessageTool, spawnAgentTool, broadcastTool } from '../tools/agent-tools.js';
import { setSharedContextTool, getSharedContextTool, listSharedContextTool, deleteSharedContextTool } from '../tools/shared-context-tools.js';
import { registerMcpToolsFromEnvironment } from '../tools/mcp-tools.js';
import { startRepl } from './repl.js';
import chalk from 'chalk';
import boxen from 'boxen';
const program = new Command();
function renderLaunchScreen(agentId, model, agentCount, toolCount) {
    const title = [
        '╔╦╗╔═╗╦═╗╔═╗╦ ╦╔═╗╔═╗╔╦╗╦═╗╔═╗╔╦╗╔═╗╦═╗',
        ' ║║║ ║╠╦╝║  ╠═╣║╣ ╚═╗ ║ ╠╦╝╠═╣ ║ ║ ║╠╦╝',
        '═╩╝╚═╝╩╚═╚═╝╩ ╩╚═╝╚═╝ ╩ ╩╚═╩ ╩ ╩ ╚═╝╩╚═'
    ].join('\n');
    const summary = [
        `${chalk.hex('#9fb0c3')('Built-in agent console')}`,
        `${chalk.hex('#5b7088')('────────────────────────────────────────')}`,
        `${chalk.hex('#7dd3fc')('Agent')}   ${chalk.white(agentId)}`,
        `${chalk.hex('#7dd3fc')('Model')}   ${chalk.white(model)}`,
        `${chalk.hex('#7dd3fc')('Fleet')}   ${chalk.white(`${agentCount} agents`)}`,
        `${chalk.hex('#7dd3fc')('Tools')}   ${chalk.white(`${toolCount} registered`)}`,
        `${chalk.hex('#7dd3fc')('Mode')}    ${chalk.white('Interactive terminal')}`
    ].join('\n');
    console.clear();
    console.log(boxen(`${chalk.hex('#8ec5ff').bold(title)}\n\n${summary}`, {
        padding: { top: 1, right: 2, bottom: 1, left: 2 },
        margin: { top: 0, bottom: 1, left: 0, right: 0 },
        borderStyle: 'round',
        borderColor: 'cyan',
        backgroundColor: '#08111f'
    }));
}
function addToolsToAgents(agentConfigs, toolIds) {
    for (const agentConfig of agentConfigs) {
        for (const toolId of toolIds) {
            if (!agentConfig.tools.includes(toolId)) {
                agentConfig.tools.push(toolId);
            }
        }
    }
}
export function registerAgentFactories() {
    agentRegistry.registerFactory('coding', (config) => new CodingAgent(config));
    agentRegistry.registerFactory('explorer', (config) => new ExplorerAgent(config));
    agentRegistry.registerFactory('planner', (config) => new PlannerAgent(config));
    agentRegistry.registerFactory('reviewer', (config) => new ReviewerAgent(config));
}
function buildDynamicAgentConfig(agentId, model, systemPrompt) {
    return {
        id: agentId,
        name: agentId,
        type: 'coding',
        description: 'Dynamic coding agent',
        systemPrompt,
        model,
        temperature: 0.7,
        maxTokens: 4096,
        contextWindow: 200000,
        tools: ['read', 'write', 'edit', 'glob', 'grep', 'searchCode', 'getDependencies', 'findSymbol'],
        permissions: {
            fileWrite: true,
            shellExec: false,
            networkAccess: false
        }
    };
}
program
    .name('coding-agent')
    .description('Production-grade coding agent system')
    .version('0.1.0');
program
    .command('start')
    .description('Start interactive coding agent')
    .option('-c, --config <path>', 'Path to config file')
    .option('-a, --agent <id>', 'Agent ID to use', 'main-coder')
    .option('-m, --model <name>', 'Model to use (overrides config)')
    .option('-s, --system-prompt <text>', 'System prompt to append')
    .action(async (options) => {
    try {
        // Load config
        await configLoader.load(options.config);
        const config = configLoader.get();
        // Register LLM providers from config
        providerRegistry.loadFromConfig(config);
        // Register tools
        toolRegistry.register(readTool);
        toolRegistry.register(writeTool);
        toolRegistry.register(editTool);
        toolRegistry.register(globTool);
        toolRegistry.register(grepTool);
        toolRegistry.register(bashTool);
        toolRegistry.register(searchCodeTool);
        toolRegistry.register(getDependenciesTool);
        toolRegistry.register(findSymbolTool);
        toolRegistry.register(indexCodebaseTool);
        toolRegistry.register(sendMessageTool);
        toolRegistry.register(spawnAgentTool);
        toolRegistry.register(broadcastTool);
        toolRegistry.register(setSharedContextTool);
        toolRegistry.register(getSharedContextTool);
        toolRegistry.register(listSharedContextTool);
        toolRegistry.register(deleteSharedContextTool);
        let mcpToolIds = [];
        try {
            mcpToolIds = await registerMcpToolsFromEnvironment((tool) => {
                toolRegistry.register(tool);
            });
        }
        catch (error) {
            console.warn(chalk.yellow(`Failed to initialize MCP tools: ${error instanceof Error ? error.message : String(error)}`));
        }
        addToolsToAgents(config.agents, mcpToolIds);
        // Register agent factories
        registerAgentFactories();
        // Initialize orchestrator
        const orchestrator = new Orchestrator({
            workingDirectory: process.cwd(),
            maxConcurrentAgents: 5,
            defaultModel: config.defaults.model,
            defaultTemperature: 0.7
        });
        await orchestrator.initialize();
        // Create agents from config
        for (const agentConfig of config.agents) {
            orchestrator.createAgent(agentConfig);
        }
        const existingAgent = orchestrator.getAgent(options.agent);
        if (existingAgent) {
            if (options.model)
                existingAgent.config.model = options.model;
            if (options.systemPrompt) {
                existingAgent.config.systemPrompt = existingAgent.config.systemPrompt
                    ? `${existingAgent.config.systemPrompt}\n\n${options.systemPrompt}`
                    : options.systemPrompt;
            }
        }
        else {
            const dynamicAgent = buildDynamicAgentConfig(options.agent, options.model || config.defaults.model, options.systemPrompt || '');
            addToolsToAgents([dynamicAgent], mcpToolIds);
            orchestrator.createAgent(dynamicAgent);
        }
        const activeAgent = orchestrator.getAgent(options.agent);
        renderLaunchScreen(options.agent, activeAgent?.config.model || options.model || config.defaults.model, config.agents.length, toolRegistry.getAll().length);
        // Start REPL
        await startRepl(orchestrator, options.agent);
    }
    catch (error) {
        console.error(chalk.red('Error:'), error);
        process.exit(1);
    }
});
program
    .command('list-agents')
    .description('List all available agents')
    .action(async () => {
    await configLoader.load();
    const config = configLoader.get();
    console.log(chalk.blue('\nAvailable Agents:\n'));
    for (const agent of config.agents) {
        console.log(chalk.bold(agent.name), chalk.gray(`(${agent.id})`));
        console.log(chalk.gray(`  Type: ${agent.type}`));
        console.log(chalk.gray(`  Model: ${agent.model}`));
        console.log(chalk.gray(`  Tools: ${agent.tools.join(', ')}`));
        console.log();
    }
});
program
    .command('list-models')
    .description('List all available models')
    .action(async () => {
    console.log(chalk.blue('\nAvailable Models:\n'));
    console.log(chalk.bold('Anthropic:'));
    console.log('  - claude-opus-4-6');
    console.log('  - claude-sonnet-4-6');
    console.log('  - claude-haiku-4-5');
    console.log(chalk.bold('\nOpenAI:'));
    console.log('  - gpt-4-turbo');
    console.log('  - gpt-4');
    console.log('  - gpt-3.5-turbo');
    console.log(chalk.bold('\nOllama (local):'));
    console.log('  - codellama:13b');
    console.log('  - deepseek-coder:6.7b');
    console.log('  - mistral:7b');
    console.log();
});
program
    .command('index')
    .description('Manage codebase index')
    .option('-b, --build', 'Build index')
    .option('-i, --incremental', 'Incremental build')
    .option('-s, --stats', 'Show statistics')
    .action(async (options) => {
    const { CodebaseIndexer } = await import('../context/indexer.js');
    const { resolve } = await import('node:path');
    const ora = (await import('ora')).default;
    const dbPath = resolve(process.cwd(), '.coding-agent/index.db');
    const indexer = new CodebaseIndexer(dbPath, process.cwd());
    if (options.stats) {
        const stats = indexer.getStats();
        console.log(chalk.blue('\nIndex Statistics:'));
        console.log(chalk.gray(`  Files: ${stats.filesIndexed}`));
        console.log(chalk.gray(`  Symbols: ${stats.symbolsFound}`));
        console.log(chalk.gray(`  Dependencies: ${stats.dependenciesFound}`));
        console.log();
    }
    else if (options.build) {
        const spinner = ora('Building codebase index...').start();
        try {
            const stats = await indexer.buildIndex({
                incremental: options.incremental || false
            });
            spinner.succeed('Index built successfully');
            console.log(chalk.gray(`  Files: ${stats.filesIndexed}, Symbols: ${stats.symbolsFound}, Time: ${stats.duration}ms`));
        }
        catch (error) {
            spinner.fail('Failed to build index');
            console.error(chalk.red('Error:'), error);
        }
    }
    else {
        console.log(chalk.yellow('Use --build to build index or --stats to show statistics'));
    }
    indexer.close();
});
const isDirectExecution = process.argv[1]
    ? resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;
if (isDirectExecution) {
    program.parse();
}
//# sourceMappingURL=index.js.map