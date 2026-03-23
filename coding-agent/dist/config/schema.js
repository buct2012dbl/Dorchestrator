import { z } from 'zod';
export const ToolParameterSchema = z.object({
    type: z.literal('object'),
    properties: z.record(z.any()),
    required: z.array(z.string()).optional()
});
export const ToolSchema = z.object({
    id: z.string(),
    description: z.string(),
    parameters: ToolParameterSchema
});
export const AgentPermissionsSchema = z.object({
    fileWrite: z.boolean(),
    shellExec: z.boolean(),
    networkAccess: z.boolean()
});
export const AgentConfigSchema = z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    description: z.string(),
    systemPrompt: z.string(),
    model: z.string(),
    provider: z.string().optional(),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().positive(),
    contextWindow: z.number().positive(),
    tools: z.array(z.string()),
    permissions: AgentPermissionsSchema
});
export const LLMProviderConfigSchema = z.object({
    type: z.enum(['anthropic', 'openai', 'ollama', 'openai-compatible', 'anthropic-compatible', 'azure-openai']),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
    models: z.array(z.string()).optional(),
    headers: z.record(z.string()).optional(),
    defaultParams: z.object({
        temperature: z.number().optional(),
        maxTokens: z.number().optional()
    }).optional(),
    // Azure-specific
    apiVersion: z.string().optional(),
    deployment: z.string().optional()
});
export const ConfigSchema = z.object({
    agents: z.array(AgentConfigSchema),
    defaults: z.object({
        model: z.string(),
        provider: z.string()
    }),
    llm: z.object({
        providers: z.record(LLMProviderConfigSchema),
        fallbackChain: z.array(z.string()),
        modelAliases: z.record(z.string()).optional()
    }).optional()
});
//# sourceMappingURL=schema.js.map