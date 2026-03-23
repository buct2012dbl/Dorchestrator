import { BaseAgent } from './base-agent.js';
import type { AgentConfig } from '../core/agent-registry.js';
export declare class ReviewerAgent extends BaseAgent {
    constructor(config: AgentConfig);
    process(message: string): Promise<string>;
}
//# sourceMappingURL=reviewer-agent.d.ts.map