export interface CliTimelineEvent {
    kind: 'assistant' | 'command' | 'error' | 'tool';
    phase?: 'running' | 'completed';
    title: string;
    text?: string;
    toolName?: string;
    toolState?: 'queued' | 'running' | 'completed' | 'failed';
    summary?: string;
}
export declare function emitCliTimelineEvent(event: CliTimelineEvent): void;
//# sourceMappingURL=timeline-events.d.ts.map