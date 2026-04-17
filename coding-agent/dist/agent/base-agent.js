import { sessionManager } from '../core/session.js';
import { messageBus } from '../core/message-bus.js';
import { toolRegistry } from '../tools/tool-registry.js';
import { sharedContext } from '../context/shared-store.js';
import { emitCliTimelineEvent } from '../cli/timeline-events.js';
export class BaseAgent {
    config;
    constructor(config) {
        this.config = config;
    }
    async executeToolCall(toolId, args) {
        const session = sessionManager.current();
        emitCliTimelineEvent({
            kind: 'command',
            phase: 'running',
            title: `Tool: ${toolId}`,
            text: JSON.stringify(args, null, 2),
        });
        await messageBus.publish('tool:execute', { toolId, args }, {
            sessionId: session.id,
            agentId: this.config.id
        });
        const result = await toolRegistry.execute(toolId, args, {
            sessionId: session.id,
            agentId: this.config.id,
            workingDirectory: process.cwd()
        });
        await messageBus.publish('tool:result', { toolId, result }, {
            sessionId: session.id,
            agentId: this.config.id
        });
        emitCliTimelineEvent({
            kind: result?.success ? 'command' : 'error',
            phase: 'completed',
            title: result?.success ? `Tool Complete: ${toolId}` : `Tool Failed: ${toolId}`,
            text: JSON.stringify(result, null, 2),
        });
        return result;
    }
    getTools() {
        return toolRegistry.getForAgent(this.config.id, this.config.tools);
    }
    async sendToAgent(targetId, message) {
        const result = await this.executeToolCall('send_message', {
            agent_id: targetId,
            message
        });
        if (!result.success) {
            throw new Error(result.error || 'Failed to send message');
        }
        return result.data.response;
    }
    async spawnSubagent(type, task) {
        const result = await this.executeToolCall('spawn_agent', {
            agent_type: type,
            task
        });
        if (!result.success) {
            throw new Error(result.error || 'Failed to spawn subagent');
        }
        return result.data.response;
    }
    getSharedContext() {
        return sharedContext;
    }
}
//# sourceMappingURL=base-agent.js.map