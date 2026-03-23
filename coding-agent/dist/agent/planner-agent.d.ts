import { BaseAgent } from './base-agent.js';
import type { AgentConfig } from '../core/agent-registry.js';
export declare class PlannerAgent extends BaseAgent {
    constructor(config: AgentConfig);
    process(message: string): Promise<string>;
}
//# sourceMappingURL=planner-agent.d.ts.map