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
          className={`kanban-timeline-event kind-${event.kind || 'assistant'} phase-${event.phase || 'completed'}`}
        >
          <div className="kanban-timeline-event-header">
            <span className="kanban-timeline-event-title">{event.title || 'Update'}</span>
            <span className={`kanban-timeline-event-badge kind-${event.kind || 'assistant'}`}>
              {event.kind === 'assistant' ? 'reply' : event.kind}
            </span>
          </div>
          {event.text && <pre>{event.text}</pre>}
        </article>
      ))}
    </div>
  );
}

export default KanbanExecutionTimeline;
