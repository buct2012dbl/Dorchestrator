export const defaultConfig = {
    agents: [
        {
            id: 'main-coder',
            type: 'coding',
            name: 'Main Coding Agent',
            description: 'Primary agent for implementation tasks',
            systemPrompt: 'You are an expert coding agent with access to a large codebase context.',
            model: 'claude-sonnet-4-6',
            temperature: 0.7,
            maxTokens: 8000,
            contextWindow: 180000,
            tools: ['read', 'write', 'edit', 'bash', 'grep', 'glob', 'send_message', 'spawn_agent'],
            permissions: {
                fileWrite: true,
                shellExec: true,
                networkAccess: false
            }
        },
        {
            id: 'explorer',
            type: 'explorer',
            name: 'Codebase Explorer',
            description: 'Fast codebase analysis and search',
            systemPrompt: 'You are a codebase exploration specialist. Analyze code structure and find relevant files.',
            model: 'claude-sonnet-4-6',
            temperature: 0.3,
            maxTokens: 4000,
            contextWindow: 100000,
            tools: ['read', 'grep', 'glob', 'get_dependencies'],
            permissions: {
                fileWrite: false,
                shellExec: false,
                networkAccess: false
            }
        },
        {
            id: 'planner',
            type: 'planner',
            name: 'Task Planner',
            description: 'Breaks down complex tasks into steps',
            systemPrompt: 'You are a task planning specialist. Break down complex tasks into actionable steps.',
            model: 'claude-sonnet-4-6',
            temperature: 0.5,
            maxTokens: 4000,
            contextWindow: 100000,
            tools: ['read', 'grep', 'glob'],
            permissions: {
                fileWrite: false,
                shellExec: false,
                networkAccess: false
            }
        },
        {
            id: 'reviewer',
            type: 'reviewer',
            name: 'Code Reviewer',
            description: 'Reviews code for quality and security',
            systemPrompt: 'You are a code review specialist. Check for bugs, security issues, and suggest improvements.',
            model: 'claude-sonnet-4-6',
            temperature: 0.3,
            maxTokens: 4000,
            contextWindow: 100000,
            tools: ['read', 'grep', 'glob'],
            permissions: {
                fileWrite: false,
                shellExec: false,
                networkAccess: false
            }
        }
    ],
    defaults: {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic'
    }
};
//# sourceMappingURL=defaults.js.map