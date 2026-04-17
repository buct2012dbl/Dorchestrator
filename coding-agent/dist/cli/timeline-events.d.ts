export interface CliTimelineEvent {
    kind: 'assistant' | 'command' | 'error';
    phase?: 'running' | 'completed';
    title: string;
    text?: string;
}
export declare function emitCliTimelineEvent(event: CliTimelineEvent): void;
//# sourceMappingURL=timeline-events.d.ts.map