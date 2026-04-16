import React, { useEffect, useMemo, useState } from 'react';
import AgentConfigPanel from '../swarm/AgentConfigPanel';
import KanbanExecutionTimeline from './KanbanExecutionTimeline';
import KanbanTranscriptTerminal from './KanbanTranscriptTerminal';
import { AGENT_TEMPLATES, createAgentDefinitionFromTemplate } from '../../store/agentStore';
import './KanbanWorkspace.css';

const STAGES = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'in_review', label: 'In Review' },
  { id: 'done', label: 'Done' },
];

const STAGE_TONES = {
  backlog: 'tertiary',
  todo: 'muted',
  in_progress: 'accent',
  in_review: 'secondary',
  done: 'accent',
};

function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}

function hasVisibleTranscript(run) {
  return Boolean((run?.transcript || '').trim());
}

function hasVisibleTimeline(run) {
  return Array.isArray(run?.timelineEvents) && run.timelineEvents.length > 0;
}

function KanbanWorkspace({
  sharedAgents,
  swarms,
  kanbanState,
  onChangeSelectedView,
  onSaveAgent,
  onDeleteAgent,
  onCreateTask,
  onMoveTask,
  onDeleteTask,
  onStartTask,
  onUpdateTask,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftTargetType, setDraftTargetType] = useState('agent');
  const [draftTargetId, setDraftTargetId] = useState(sharedAgents[0]?.id || '');
  const [draftEntryAgentId, setDraftEntryAgentId] = useState('');
  const [reviewReply, setReviewReply] = useState('');

  const selectedAgent = sharedAgents.find((agent) => agent.id === selectedAgentId) || null;
  const activeTask = kanbanState.tasks.find((task) => task.id === activeTaskId) || null;
  const selectedAgentNode = selectedAgent
    ? { id: selectedAgent.id, data: { ...selectedAgent } }
    : null;

  const tasksByStage = useMemo(() => {
    const grouped = Object.fromEntries(STAGES.map((stage) => [stage.id, []]));
    for (const task of kanbanState.tasks) {
      const stageId = grouped[task.stage] ? task.stage : 'todo';
      grouped[stageId].push(task);
    }
    return grouped;
  }, [kanbanState.tasks]);

  const availableEntryAgents = useMemo(() => {
    const swarm = swarms.find((item) => item.id === draftTargetId);
    return swarm?.agents || [];
  }, [draftTargetId, swarms]);

  useEffect(() => {
    if (draftTargetType === 'agent' && !draftTargetId && sharedAgents[0]?.id) {
      setDraftTargetId(sharedAgents[0].id);
    }
    if (draftTargetType === 'swarm' && !draftTargetId && swarms[0]?.id) {
      setDraftTargetId(swarms[0].id);
    }
  }, [draftTargetId, draftTargetType, sharedAgents, swarms]);

  const handleQuickAddAgent = async (templateKey) => {
    const nextAgent = createAgentDefinitionFromTemplate(templateKey, {}, new Set(sharedAgents.map((agent) => agent.id)));
    await onSaveAgent(nextAgent);
    setSelectedAgentId(nextAgent.id);
    onChangeSelectedView('agents');
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!draftTitle.trim() || !draftPrompt.trim() || !draftTargetId) {
      return;
    }
    await onCreateTask({
      title: draftTitle.trim(),
      prompt: draftPrompt.trim(),
      targetType: draftTargetType,
      targetId: draftTargetId,
      entryAgentId: draftTargetType === 'swarm' ? (draftEntryAgentId || availableEntryAgents[0]?.id || null) : null,
    });
    setDraftTitle('');
    setDraftPrompt('');
    setDraftTargetType('agent');
    setDraftTargetId(sharedAgents[0]?.id || '');
    setDraftEntryAgentId('');
    setShowTaskComposer(false);
  };

  const handleOpenTask = (task) => {
    setActiveTaskId(task.id);
    setReviewReply('');
  };

  const handleReply = async () => {
    if (!activeTask || !reviewReply.trim()) return;
    await onStartTask(activeTask.id, reviewReply.trim());
    setReviewReply('');
  };

  const handleMarkDone = async () => {
    if (!activeTask) return;
    await onUpdateTask(activeTask.id, { stage: 'done', runStatus: 'idle', updatedAt: new Date().toISOString() });
    setActiveTaskId(null);
  };

  const renderBoard = () => (
    <div className="kanban-board">
      <div className="kanban-board-toolbar">
        <div className="kanban-board-heading">
          <div className="kanban-board-title cyber-glitch" data-text="Execution Board">Execution Board</div>
          <div className="kanban-board-subtitle">
            <span className="kanban-terminal-prefix">&gt;</span>
            Drag cards between stages. Moving a card into In Progress starts the background run.
            <span className="cyber-cursor">_</span>
          </div>
        </div>
        <button className="kanban-primary-btn" onClick={() => setShowTaskComposer(true)}>New Task</button>
      </div>
      <div className="kanban-columns">
        {STAGES.map((stage) => (
          <div
            key={stage.id}
            className={`kanban-column stage-${stage.id}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const taskId = e.dataTransfer.getData('text/task-id');
              if (taskId) {
                onMoveTask(taskId, stage.id);
              }
            }}
          >
            <div className="kanban-column-header">
              <span className="kanban-column-title">{stage.label}</span>
              <span className={`kanban-column-count tone-${STAGE_TONES[stage.id] || 'muted'}`}>{tasksByStage[stage.id].length}</span>
            </div>
            <div className="kanban-card-list">
              {tasksByStage[stage.id].map((task) => (
                <button
                  key={task.id}
                  className={`kanban-card ${task.runStatus === 'running' ? 'running' : ''} status-${task.runStatus}`}
                  draggable={task.runStatus !== 'running'}
                  onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
                  onClick={() => handleOpenTask(task)}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title">{task.title}</span>
                    <span className={`kanban-badge ${task.runStatus}`}>{task.runStatus.replace('_', ' ')}</span>
                  </div>
                  <div className="kanban-card-body">{task.prompt}</div>
                  <div className="kanban-card-footer">
                    <span className="kanban-card-target">{task.targetType === 'swarm' ? 'Swarm' : 'Agent'}</span>
                    <span>{formatTime(task.updatedAt)}</span>
                  </div>
                </button>
              ))}
              {tasksByStage[stage.id].length === 0 && (
                <div className="kanban-column-empty">
                  <span className="kanban-terminal-prefix">&gt;</span>
                  No tasks in this lane
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <button className="kanban-fab" onClick={() => setShowTaskComposer(true)} aria-label="Create task">
        New Task
      </button>
    </div>
  );

  const renderAgents = () => (
    <div className="kanban-agents-view">
      <div className="kanban-board-toolbar">
        <div className="kanban-board-heading">
          <div className="kanban-board-title">Shared Agents</div>
          <div className="kanban-board-subtitle">
            <span className="kanban-terminal-prefix">$</span>
            These agents are available for Kanban tasks and appear in Swarm graph creation controls.
          </div>
        </div>
      </div>
      <div className="kanban-template-row">
        {Object.entries(AGENT_TEMPLATES).map(([key, tmpl]) => (
          <button
            key={key}
            className="kanban-template-btn"
            style={{ borderLeftColor: tmpl.color }}
            onClick={() => handleQuickAddAgent(key)}
          >
            + {tmpl.role}
          </button>
        ))}
      </div>
      <div className="kanban-agent-grid">
        {sharedAgents.map((agent) => (
          <button
            key={agent.id}
            className={`kanban-agent-card ${selectedAgentId === agent.id ? 'active' : ''}`}
            onClick={() => setSelectedAgentId(agent.id)}
          >
            <span className="kanban-agent-swatch" style={{ background: agent.color }} />
            <div className="kanban-agent-card-title">{agent.name}</div>
            <div className="kanban-agent-card-subtitle">{agent.role}</div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="kanban-workspace">
      <aside className="kanban-sidebar">
        <div className="kanban-sidebar-title">Kanban</div>
        <div className="kanban-sidebar-subtitle">Neural Control</div>
        <button
          className={`kanban-sidebar-item ${kanbanState.selectedView === 'board' ? 'active' : ''}`}
          onClick={() => onChangeSelectedView('board')}
        >
          Board
        </button>
        <button
          className={`kanban-sidebar-item ${kanbanState.selectedView === 'agents' ? 'active' : ''}`}
          onClick={() => onChangeSelectedView('agents')}
        >
          Agents
        </button>
      </aside>

      <div className="kanban-content">
        {kanbanState.selectedView === 'agents' ? renderAgents() : renderBoard()}
      </div>

      {selectedAgentNode && kanbanState.selectedView === 'agents' && (
        <div className="config-sidebar">
          <AgentConfigPanel
            agent={selectedAgentNode}
            onUpdate={(id, updates) => onSaveAgent({ ...selectedAgent, ...updates, id })}
            onClose={() => setSelectedAgentId(null)}
            onRemove={async (id) => {
              await onDeleteAgent(id);
              setSelectedAgentId(null);
            }}
          />
        </div>
      )}

      {showTaskComposer && (
        <div className="config-confirm-overlay" onClick={() => setShowTaskComposer(false)}>
          <div className="kanban-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create Task</h3>
            <form className="kanban-form" onSubmit={handleCreateTask}>
              <label>Task Name</label>
              <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} />
              <label>First Prompt</label>
              <textarea rows={8} value={draftPrompt} onChange={(e) => setDraftPrompt(e.target.value)} />
              <label>Run With</label>
              <select
                value={draftTargetType}
                onChange={(e) => {
                  const nextType = e.target.value;
                  setDraftTargetType(nextType);
                  setDraftTargetId(nextType === 'agent' ? (sharedAgents[0]?.id || '') : (swarms[0]?.id || ''));
                  setDraftEntryAgentId('');
                }}
              >
                <option value="agent">Agent</option>
                <option value="swarm">Swarm</option>
              </select>
              <label>{draftTargetType === 'agent' ? 'Agent' : 'Swarm'}</label>
              <select value={draftTargetId} onChange={(e) => setDraftTargetId(e.target.value)}>
                {(draftTargetType === 'agent' ? sharedAgents : swarms).map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
              {draftTargetType === 'swarm' && (
                <>
                  <label>Entry Agent</label>
                  <select value={draftEntryAgentId} onChange={(e) => setDraftEntryAgentId(e.target.value)}>
                    {availableEntryAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.data?.name || agent.id}</option>
                    ))}
                  </select>
                </>
              )}
              <div className="config-confirm-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowTaskComposer(false)}>Cancel</button>
                <button type="submit" className="btn-confirm">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTask && (
        <div className="config-confirm-overlay" onClick={() => setActiveTaskId(null)}>
          <div className="kanban-modal kanban-task-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kanban-task-modal-header">
              <div>
                <h3>{activeTask.title}</h3>
                <p>{activeTask.runStatus === 'running' ? 'Task is processing in the background.' : 'Review the full run history or send follow-up feedback.'}</p>
              </div>
              <button className="config-close" onClick={() => setActiveTaskId(null)}>x</button>
            </div>
            <div className="kanban-task-runs">
              {(activeTask.runs || []).slice().reverse().map((run, index) => (
                <details key={run.id} className="kanban-run" open={index === 0}>
                  <summary>
                    <span>Run {activeTask.runs.length - index}</span>
                    <span>{run.status}</span>
                    <span>{formatTime(run.startedAt)}</span>
                  </summary>
                  <div className="kanban-run-body">
                    {run.renderMode === 'timeline' && (
                      <div className="kanban-run-section">
                        <div className="kanban-run-section-label">Execution Timeline</div>
                        <KanbanExecutionTimeline
                          events={run.timelineEvents || []}
                          isRunning={run.status === 'running'}
                        />
                      </div>
                    )}
                    {run.renderMode !== 'timeline' && hasVisibleTranscript(run) && (
                      <div className="kanban-run-section">
                        <div className="kanban-run-section-label">Live Transcript</div>
                        <KanbanTranscriptTerminal
                          sessionKey={run.id}
                          transcript={run.transcript || ''}
                        />
                      </div>
                    )}
                    <div className="kanban-run-section">
                      <div className="kanban-run-section-label">Prompt</div>
                      <pre>{run.displayPrompt || run.reply || activeTask.prompt}</pre>
                    </div>
                    {run.reply && (
                      <div className="kanban-run-section">
                        <div className="kanban-run-section-label">Reviewer Feedback</div>
                        <pre>{run.reply}</pre>
                      </div>
                    )}
                    {run.finalResponse && (
                      <div className="kanban-run-section">
                        <div className="kanban-run-section-label">Reply</div>
                        <pre>{run.finalResponse}</pre>
                      </div>
                    )}
                    {run.renderMode !== 'timeline' && !hasVisibleTranscript(run) && (run.segments || []).map((segment) => (
                      <div key={segment.id} className="kanban-run-segment">
                        <div className="kanban-run-segment-header">{segment.agentName}</div>
                        <pre>{segment.text}</pre>
                      </div>
                    ))}
                    {!run.finalResponse && run.renderMode === 'timeline' && !hasVisibleTimeline(run) && (
                      <div className="kanban-run-empty">No response yet. Waiting for the agent to emit structured progress.</div>
                    )}
                    {!run.finalResponse && run.renderMode !== 'timeline' && !hasVisibleTranscript(run) && (!run.segments || run.segments.length === 0) && (
                      <div className="kanban-run-empty">No streamed terminal output was captured for this run.</div>
                    )}
                  </div>
                </details>
              ))}
            </div>
            {activeTask.lastError && <div className="kanban-error-banner">{activeTask.lastError}</div>}
            {activeTask.stage === 'in_review' && (
              <div className="kanban-review-box">
                <label>Reply</label>
                <textarea rows={5} value={reviewReply} onChange={(e) => setReviewReply(e.target.value)} />
                <div className="config-confirm-actions">
                  <button className="btn-delete" onClick={() => onDeleteTask(activeTask.id)}>Delete</button>
                  <button className="btn-cancel" onClick={handleMarkDone}>Mark Done</button>
                  <button className="btn-confirm" onClick={handleReply}>Send Reply</button>
                </div>
              </div>
            )}
            {activeTask.stage !== 'in_review' && activeTask.runStatus !== 'running' && (
              <div className="config-confirm-actions">
                <button className="btn-delete" onClick={() => onDeleteTask(activeTask.id)}>Delete</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanWorkspace;
