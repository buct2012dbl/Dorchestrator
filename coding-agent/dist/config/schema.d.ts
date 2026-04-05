import { z } from 'zod';
export declare const ToolParameterSchema: z.ZodObject<{
    type: z.ZodLiteral<"object">;
    properties: z.ZodRecord<z.ZodString, z.ZodAny>;
    required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}, {
    type: "object";
    properties: Record<string, any>;
    required?: string[] | undefined;
}>;
export declare const ToolSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodRecord<z.ZodString, z.ZodAny>;
        required: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    }, {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    };
}, {
    id: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, any>;
        required?: string[] | undefined;
    };
}>;
export declare const AgentPermissionsSchema: z.ZodObject<{
    fileWrite: z.ZodBoolean;
    shellExec: z.ZodBoolean;
    networkAccess: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    fileWrite: boolean;
    shellExec: boolean;
    networkAccess: boolean;
}, {
    fileWrite: boolean;
    shellExec: boolean;
    networkAccess: boolean;
}>;
export declare const AgentConfigSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    systemPrompt: z.ZodString;
    model: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    temperature: z.ZodNumber;
    maxTokens: z.ZodNumber;
    contextWindow: z.ZodNumber;
    tools: z.ZodArray<z.ZodString, "many">;
    permissions: z.ZodObject<{
        fileWrite: z.ZodBoolean;
        shellExec: z.ZodBoolean;
        networkAccess: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        fileWrite: boolean;
        shellExec: boolean;
        networkAccess: boolean;
    }, {
        fileWrite: boolean;
        shellExec: boolean;
        networkAccess: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    systemPrompt: string;
    tools: string[];
    id: string;
    type: string;
    name: string;
    temperature: number;
    model: string;
    maxTokens: number;
    description: string;
    contextWindow: number;
    permissions: {
        fileWrite: boolean;
        shellExec: boolean;
        networkAccess: boolean;
    };
    provider?: string | undefined;
}, {
    systemPrompt: string;
    tools: string[];
    id: string;
    type: string;
    name: string;
    temperature: number;
    model: string;
    maxTokens: number;
    description: string;
    contextWindow: number;
    permissions: {
        fileWrite: boolean;
        shellExec: boolean;
        networkAccess: boolean;
    };
    provider?: string | undefined;
}>;
export declare const LLMProviderConfigSchema: z.ZodObject<{
    type: z.ZodEnum<["anthropic", "openai", "ollama", "openai-compatible", "anthropic-compatible", "azure-openai"]>;
    apiKey: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodString>;
    models: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    defaultParams: z.ZodOptional<z.ZodObject<{
        temperature: z.ZodOptional<z.ZodNumber>;
        maxTokens: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    }, {
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    }>>;
    apiVersion: z.ZodOptional<z.ZodString>;
    deployment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
    apiKey?: string | undefined;
    headers?: Record<string, string> | undefined;
    baseUrl?: string | undefined;
    models?: string[] | undefined;
    defaultParams?: {
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    } | undefined;
    apiVersion?: string | undefined;
    deployment?: string | undefined;
}, {
    type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
    apiKey?: string | undefined;
    headers?: Record<string, string> | undefined;
    baseUrl?: string | undefined;
    models?: string[] | undefined;
    defaultParams?: {
        temperature?: number | undefined;
        maxTokens?: number | undefined;
    } | undefined;
    apiVersion?: string | undefined;
    deployment?: string | undefined;
}>;
export declare const ConfigSchema: z.ZodObject<{
    agents: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        systemPrompt: z.ZodString;
        model: z.ZodString;
        provider: z.ZodOptional<z.ZodString>;
        temperature: z.ZodNumber;
        maxTokens: z.ZodNumber;
        contextWindow: z.ZodNumber;
        tools: z.ZodArray<z.ZodString, "many">;
        permissions: z.ZodObject<{
            fileWrite: z.ZodBoolean;
            shellExec: z.ZodBoolean;
            networkAccess: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        }, {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        systemPrompt: string;
        tools: string[];
        id: string;
        type: string;
        name: string;
        temperature: number;
        model: string;
        maxTokens: number;
        description: string;
        contextWindow: number;
        permissions: {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        };
        provider?: string | undefined;
    }, {
        systemPrompt: string;
        tools: string[];
        id: string;
        type: string;
        name: string;
        temperature: number;
        model: string;
        maxTokens: number;
        description: string;
        contextWindow: number;
        permissions: {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        };
        provider?: string | undefined;
    }>, "many">;
    defaults: z.ZodObject<{
        model: z.ZodString;
        provider: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        model: string;
        provider: string;
    }, {
        model: string;
        provider: string;
    }>;
    llm: z.ZodOptional<z.ZodObject<{
        providers: z.ZodRecord<z.ZodString, z.ZodObject<{
            type: z.ZodEnum<["anthropic", "openai", "ollama", "openai-compatible", "anthropic-compatible", "azure-openai"]>;
            apiKey: z.ZodOptional<z.ZodString>;
            baseUrl: z.ZodOptional<z.ZodString>;
            models: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
            defaultParams: z.ZodOptional<z.ZodObject<{
                temperature: z.ZodOptional<z.ZodNumber>;
                maxTokens: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            }, {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            }>>;
            apiVersion: z.ZodOptional<z.ZodString>;
            deployment: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            baseUrl?: string | undefined;
            models?: string[] | undefined;
            defaultParams?: {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            } | undefined;
            apiVersion?: string | undefined;
            deployment?: string | undefined;
        }, {
            type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            baseUrl?: string | undefined;
            models?: string[] | undefined;
            defaultParams?: {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            } | undefined;
            apiVersion?: string | undefined;
            deployment?: string | undefined;
        }>>;
        fallbackChain: z.ZodArray<z.ZodString, "many">;
        modelAliases: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        providers: Record<string, {
            type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            baseUrl?: string | undefined;
            models?: string[] | undefined;
            defaultParams?: {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            } | undefined;
            apiVersion?: string | undefined;
            deployment?: string | undefined;
        }>;
        fallbackChain: string[];
        modelAliases?: Record<string, string> | undefined;
    }, {
        providers: Record<string, {
            type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            baseUrl?: string | undefined;
            models?: string[] | undefined;
            defaultParams?: {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            } | undefined;
            apiVersion?: string | undefined;
            deployment?: string | undefined;
        }>;
        fallbackChain: string[];
        modelAliases?: Record<string, string> | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    agents: {
        systemPrompt: string;
        tools: string[];
        id: string;
        type: string;
        name: string;
        temperature: number;
        model: string;
        maxTokens: number;
        description: string;
        contextWindow: number;
        permissions: {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        };
        provider?: string | undefined;
    }[];
    defaults: {
        model: string;
        provider: string;
    };
    llm?: {
        providers: Record<string, {
            type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            baseUrl?: string | undefined;
            models?: string[] | undefined;
            defaultParams?: {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            } | undefined;
            apiVersion?: string | undefined;
            deployment?: string | undefined;
        }>;
        fallbackChain: string[];
        modelAliases?: Record<string, string> | undefined;
    } | undefined;
}, {
    agents: {
        systemPrompt: string;
        tools: string[];
        id: string;
        type: string;
        name: string;
        temperature: number;
        model: string;
        maxTokens: number;
        description: string;
        contextWindow: number;
        permissions: {
            fileWrite: boolean;
            shellExec: boolean;
            networkAccess: boolean;
        };
        provider?: string | undefined;
    }[];
    defaults: {
        model: string;
        provider: string;
    };
    llm?: {
        providers: Record<string, {
            type: "anthropic" | "openai" | "ollama" | "openai-compatible" | "anthropic-compatible" | "azure-openai";
            apiKey?: string | undefined;
            headers?: Record<string, string> | undefined;
            baseUrl?: string | undefined;
            models?: string[] | undefined;
            defaultParams?: {
                temperature?: number | undefined;
                maxTokens?: number | undefined;
            } | undefined;
            apiVersion?: string | undefined;
            deployment?: string | undefined;
        }>;
        fallbackChain: string[];
        modelAliases?: Record<string, string> | undefined;
    } | undefined;
}>;
export type ToolParameter = z.infer<typeof ToolParameterSchema>;
export type Tool = z.infer<typeof ToolSchema>;
export type AgentPermissions = z.infer<typeof AgentPermissionsSchema>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type LLMProviderConfig = z.infer<typeof LLMProviderConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;
//# sourceMappingURL=schema.d.ts.map