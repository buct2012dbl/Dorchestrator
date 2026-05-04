import React from 'react';
import './KanbanExecutionTimeline.css';

function KanbanExecutionTimeline({ events, isRunning }) {
  const items = Array.isArray(events) ? events : [];

  if (items.length === 0) {
    return (
      <div className="kanban-execution-timeline empty">
        {isRunning ? 'Waiting for the agent to emit progress...' : 'No structured execution events were captured for this run.'}
      </div>
    );
  }

  return (
    <div className="kanban-execution-timeline">
      {items.map((event) => (
        <article
          key={event.id}
          className={`kanban-timeline-event kind-${event.kind || 'assistant'} phase-${event.phase || 'completed'} tool-state-${event.toolState || 'none'}`}
        >
          <div className="kanban-timeline-event-header">
            <div className="kanban-timeline-event-heading">
              <span className="kanban-timeline-event-title">{event.title || 'Update'}</span>
              {event.toolName && (
                <span className="kanban-timeline-event-tool-name">{event.toolName}</span>
              )}
            </div>
            <span className={`kanban-timeline-event-badge kind-${event.kind || 'assistant'} tool-state-${event.toolState || 'none'}`}>
              {event.kind === 'assistant'
                ? 'reply'
                : event.kind === 'tool'
                  ? (event.toolState || 'tool')
                  : event.kind}
            </span>
          </div>
          {(event.summary || event.text) && (
            <pre>{event.summary || event.text}</pre>
          )}
        </article>
      ))}
    </div>
  );
}

export default KanbanExecutionTimeline;
