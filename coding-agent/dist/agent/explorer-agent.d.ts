import { BaseAgent } from './base-agent.js';
import type { AgentConfig } from '../core/agent-registry.js';
export declare class ExplorerAgent extends BaseAgent {
    constructor(config: AgentConfig);
    process(message: string): Promise<string>;
}
//# sourceMappingURL=explorer-agent.d.ts.map