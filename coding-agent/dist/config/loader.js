import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConfigSchema } from './schema.js';
import { defaultConfig } from './defaults.js';
import dotenv from 'dotenv';
export class ConfigLoader {
    config = null;
    async load(configPath) {
        // Load environment variables
        dotenv.config();
        // Try to load config file
        if (configPath) {
            try {
                const content = await readFile(configPath, 'utf-8');
                const parsed = JSON.parse(content);
                // Substitute environment variables in provider configs
                this.substituteEnvVars(parsed);
                this.config = ConfigSchema.parse(parsed);
                return this.config;
            }
            catch (error) {
                console.warn(`Failed to load config from ${configPath}, using defaults`);
            }
        }
        // Try default locations
        const defaultPaths = [
            './config/agents.json',
            './.coding-agent/config.json',
            './coding-agent.json'
        ];
        for (const path of defaultPaths) {
            try {
                const content = await readFile(resolve(path), 'utf-8');
                const parsed = JSON.parse(content);
                // Substitute environment variables in provider configs
                this.substituteEnvVars(parsed);
                this.config = ConfigSchema.parse(parsed);
                return this.config;
            }
            catch {
                continue;
            }
        }
        // Use default config
        this.config = defaultConfig;
        return this.config;
    }
    substituteEnvVars(obj) {
        if (typeof obj !== 'object' || obj === null)
            return;
        for (const key in obj) {
            if (typeof obj[key] === 'string' && obj[key].startsWith('${') && obj[key].endsWith('}')) {
                const envVar = obj[key].slice(2, -1);
                obj[key] = process.env[envVar] || obj[key];
            }
            else if (typeof obj[key] === 'object') {
                this.substituteEnvVars(obj[key]);
            }
        }
    }
    get() {
        if (!this.config) {
            throw new Error('Config not loaded. Call load() first.');
        }
        return this.config;
    }
    getAgent(id) {
        const config = this.get();
        return config.agents.find(a => a.id === id);
    }
    getProviderConfig(provider) {
        const config = this.get();
        return config.llm?.providers[provider];
    }
    resolveModelAlias(model) {
        const config = this.get();
        return config.llm?.modelAliases?.[model] || model;
    }
    getFallbackChain() {
        const config = this.get();
        return config.llm?.fallbackChain || [];
    }
    getApiKey(provider) {
        const envVars = {
            anthropic: 'ANTHROPIC_API_KEY',
            openai: 'OPENAI_API_KEY',
            google: 'GOOGLE_API_KEY',
            openrouter: 'OPENROUTER_API_KEY'
        };
        const envVar = envVars[provider];
        return envVar ? process.env[envVar] : undefined;
    }
}
export const configLoader = new ConfigLoader();
//# sourceMappingURL=loader.js.map