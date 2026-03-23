import { BaseAgent } from './base-agent.js';
import type { AgentConfig } from '../core/agent-registry.js';
export declare class CodingAgent extends BaseAgent {
    constructor(config: AgentConfig);
    process(message: string, onFirstText?: () => void): Promise<string>;
}
//# sourceMappingURL=coding-agent.d.ts.map