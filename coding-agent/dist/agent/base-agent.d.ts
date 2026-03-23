import type { AgentConfig } from '../core/agent-registry.js';
import { sharedContext } from '../context/shared-store.js';
export declare abstract class BaseAgent {
    config: AgentConfig;
    constructor(config: AgentConfig);
    abstract process(message: string, onFirstText?: () => void): Promise<string>;
    protected executeToolCall(toolId: string, args: any): Promise<any>;
    protected getTools(): import("../tools/tool-registry.js").Tool[];
    sendToAgent(targetId: string, message: string): Promise<string>;
    spawnSubagent(type: string, task: string): Promise<string>;
    getSharedContext(): typeof sharedContext;
}
//# sourceMappingURL=base-agent.d.ts.map