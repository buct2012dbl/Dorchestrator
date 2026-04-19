import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function formatDateTimeInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatScheduleSummary(task) {
  if (task.scheduleType === 'interval') {
    return `Every ${task.intervalValue} ${task.intervalUnit}`;
  }
  return task.runAt ? `One time at ${formatTime(task.runAt)}` : 'One time';
}

function getTaskTargetLabel(task) {
  if (task.targetType === 'swarm') return 'Swarm';
  if (task.targetType === 'scheduled') return 'Scheduled';
  return 'Agent';
}

function hasVisibleTranscript(run) {
  return Boolean((run?.transcript || '').trim());
}

function hasVisibleTimeline(run) {
  return Array.isArray(run?.timelineEvents) && run.timelineEvents.length > 0;
}

function hasScheduledCommandOutput(run) {
  return Boolean((run?.output || run?.stdout || run?.stderr || '').trim());
}

function getScheduledRunLog(task, run, scheduledTasks = []) {
  if (task?.targetType !== 'scheduled' || !task?.targetId) return null;
  const scheduledTask = scheduledTasks.find((item) => item.id === task.targetId);
  if (!scheduledTask) return null;
  const logs = scheduledTask.logs || [];

  if (task.scheduleLogId) {
    const exactLog = logs.find((log) => log.id === task.scheduleLogId);
    if (exactLog) return exactLog;
  }

  if (task.id) {
    const boardTaskLog = logs.find((log) => log.boardTaskId === task.id);
    if (boardTaskLog) return boardTaskLog;
  }

  if (run?.startedAt) {
    const startedLog = logs.find((log) => log.startedAt === run.startedAt);
    if (startedLog) return startedLog;
  }

  return null;
}

function KanbanWorkspace({
  sharedAgents,
  swarms,
  kanbanState,
  onChangeSelectedView,
  onSetSidebarCollapsed,
  onSaveAgent,
  onDeleteAgent,
  onCreateTask,
  onMoveTask,
  onDeleteTask,
  onStartTask,
  onUpdateTask,
  onSaveScheduledTask,
  onDeleteScheduledTask,
  onRunScheduledTaskNow,
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftTargetType, setDraftTargetType] = useState('agent');
  const [draftTargetId, setDraftTargetId] = useState(sharedAgents[0]?.id || '');
  const [draftEntryAgentId, setDraftEntryAgentId] = useState('');
  const [editingScheduledTaskId, setEditingScheduledTaskId] = useState(null);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleCommand, setScheduleCommand] = useState('');
  const [scheduleType, setScheduleType] = useState('once');
  const [scheduleRunAt, setScheduleRunAt] = useState('');
  const [scheduleIntervalValue, setScheduleIntervalValue] = useState('1');
  const [scheduleIntervalUnit, setScheduleIntervalUnit] = useState('hours');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [selectedScheduleId, setSelectedScheduleId] = useState(null);
  const [reviewReply, setReviewReply] = useState('');
  const [taskModalOffset, setTaskModalOffset] = useState({ x: 0, y: 0 });
  const [scheduleModalOffset, setScheduleModalOffset] = useState({ x: 0, y: 0 });
  const taskModalDragRef = useRef(null);
  const scheduleModalDragRef = useRef(null);

  const selectedAgent = sharedAgents.find((agent) => agent.id === selectedAgentId) || null;
  const activeTask = kanbanState.tasks.find((task) => task.id === activeTaskId) || null;
  const scheduledTasks = kanbanState.scheduledTasks || [];
  const selectedScheduledTask = scheduledTasks.find((task) => task.id === selectedScheduleId) || null;
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

  const sortedScheduledTasks = useMemo(() => (
    [...scheduledTasks].sort((left, right) => {
      const leftTime = left.nextRunAt || left.updatedAt || left.createdAt || '';
      const rightTime = right.nextRunAt || right.updatedAt || right.createdAt || '';
      return leftTime.localeCompare(rightTime);
    })
  ), [scheduledTasks]);

  useEffect(() => {
    if (draftTargetType === 'agent' && !draftTargetId && sharedAgents[0]?.id) {
      setDraftTargetId(sharedAgents[0].id);
    }
    if (draftTargetType === 'swarm' && !draftTargetId && swarms[0]?.id) {
      setDraftTargetId(swarms[0].id);
    }
  }, [draftTargetId, draftTargetType, sharedAgents, swarms]);

  useEffect(() => {
    if (!scheduledTasks.length) {
      setSelectedScheduleId(null);
      return;
    }
    if (!selectedScheduleId || !scheduledTasks.some((task) => task.id === selectedScheduleId)) {
      setSelectedScheduleId(scheduledTasks[0].id);
    }
  }, [scheduledTasks, selectedScheduleId]);

  const resetScheduledTaskForm = useCallback(() => {
    setEditingScheduledTaskId(null);
    setScheduleName('');
    setScheduleCommand('');
    setScheduleType('once');
    setScheduleRunAt('');
    setScheduleIntervalValue('1');
    setScheduleIntervalUnit('hours');
    setScheduleEnabled(true);
  }, []);

  const populateScheduledTaskForm = useCallback((task) => {
    setEditingScheduledTaskId(task?.id || null);
    setScheduleName(task?.name || '');
    setScheduleCommand(task?.command || '');
    setScheduleType(task?.scheduleType || 'once');
    setScheduleRunAt(formatDateTimeInput(task?.runAt));
    setScheduleIntervalValue(String(task?.intervalValue || 1));
    setScheduleIntervalUnit(task?.intervalUnit || 'hours');
    setScheduleEnabled(task?.enabled !== false);
    setSelectedScheduleId(task?.id || null);
  }, []);

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

  const handleOpenNewScheduleEditor = () => {
    resetScheduledTaskForm();
    setShowScheduleEditor(true);
  };

  const handleEditScheduledTask = (task) => {
    populateScheduledTaskForm(task);
    setShowScheduleEditor(true);
  };

  const handleCloseScheduleEditor = useCallback(() => {
    setShowScheduleEditor(false);
  }, []);

  const handleSubmitScheduledTask = async (e) => {
    e.preventDefault();
    if (!scheduleName.trim() || !scheduleCommand.trim()) {
      return;
    }
    if (scheduleType === 'once' && !scheduleRunAt) {
      return;
    }

    await onSaveScheduledTask({
      id: editingScheduledTaskId,
      name: scheduleName.trim(),
      command: scheduleCommand.trim(),
      scheduleType,
      runAt: scheduleType === 'once' ? new Date(scheduleRunAt).toISOString() : null,
      intervalValue: scheduleType === 'interval' ? Number.parseInt(scheduleIntervalValue, 10) || 1 : 1,
      intervalUnit: scheduleType === 'interval' ? scheduleIntervalUnit : 'hours',
      enabled: scheduleEnabled,
    });
    handleCloseScheduleEditor();
  };

  const handleDeleteScheduledTaskClick = async (taskId) => {
    await onDeleteScheduledTask(taskId);
    if (editingScheduledTaskId === taskId) {
      resetScheduledTaskForm();
    }
  };

  const handleCardKeyDown = (e, task) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleOpenTask(task);
    }
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

  const handleTaskModalDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    taskModalDragRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      originX: taskModalOffset.x,
      originY: taskModalOffset.y,
    };
    window.getSelection?.().removeAllRanges();
  }, [taskModalOffset.x, taskModalOffset.y]);

  const handleScheduleModalDragStart = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;

    scheduleModalDragRef.current = {
      pointerStartX: e.clientX,
      pointerStartY: e.clientY,
      originX: scheduleModalOffset.x,
      originY: scheduleModalOffset.y,
    };
    window.getSelection?.().removeAllRanges();
  }, [scheduleModalOffset.x, scheduleModalOffset.y]);

  useEffect(() => {
    if (!activeTaskId) {
      setTaskModalOffset({ x: 0, y: 0 });
    }
  }, [activeTaskId]);

  useEffect(() => {
    if (!showScheduleEditor) {
      setScheduleModalOffset({ x: 0, y: 0 });
    }
  }, [showScheduleEditor]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      const dragState = taskModalDragRef.current;
      if (dragState) {
        setTaskModalOffset({
          x: dragState.originX + (e.clientX - dragState.pointerStartX),
          y: dragState.originY + (e.clientY - dragState.pointerStartY),
        });
      }

      const scheduleDragState = scheduleModalDragRef.current;
      if (scheduleDragState) {
        setScheduleModalOffset({
          x: scheduleDragState.originX + (e.clientX - scheduleDragState.pointerStartX),
          y: scheduleDragState.originY + (e.clientY - scheduleDragState.pointerStartY),
        });
      }
    };

    const handleMouseUp = () => {
      taskModalDragRef.current = null;
      scheduleModalDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const renderBoard = () => (
    <div className="kanban-board">
      <div className="kanban-board-toolbar">
        <div className="kanban-board-heading">
          <div className="kanban-board-title cyber-glitch" data-text="Execution Board">Execution Board</div>
          <div className="kanban-board-subtitle">
            <span className="kanban-terminal-prefix">&gt;</span>
            Drag cards between stages. Moving an agent or swarm card into In Progress starts the background run.
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
                <div
                  key={task.id}
                  className={`kanban-card ${task.runStatus === 'running' ? 'running' : ''} status-${task.runStatus}`}
                  role="button"
                  tabIndex={0}
                  draggable={task.runStatus !== 'running'}
                  onDragStart={(e) => e.dataTransfer.setData('text/task-id', task.id)}
                  onClick={() => handleOpenTask(task)}
                  onKeyDown={(e) => handleCardKeyDown(e, task)}
                >
                  <div className="kanban-card-header">
                    <span className="kanban-card-title">{task.title}</span>
                    <div className="kanban-card-actions">
                      <span className={`kanban-badge ${task.runStatus}`}>{task.runStatus.replace('_', ' ')}</span>
                      <button
                        type="button"
                        className="kanban-card-delete"
                        aria-label={`Delete ${task.title}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTask(task.id);
                        }}
                        onDragStart={(e) => e.preventDefault()}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  <div className="kanban-card-body">{task.prompt}</div>
                  <div className="kanban-card-footer">
                    <span className="kanban-card-target">{getTaskTargetLabel(task)}</span>
                    <span>{formatTime(task.updatedAt)}</span>
                  </div>
                </div>
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

  const renderSchedules = () => (
    <div className="kanban-schedules-view">
      <div className="kanban-board-toolbar">
        <div className="kanban-board-heading">
          <div className="kanban-board-title">Scheduled Tasks</div>
          <div className="kanban-board-subtitle">
            <span className="kanban-terminal-prefix">$</span>
            Configure one-time or recurring workspace commands. Review execution output from the spawned task card in In Review.
          </div>
        </div>
        <button type="button" className="kanban-primary-btn" onClick={handleOpenNewScheduleEditor}>New</button>
      </div>
      <div className="kanban-schedule-page">
        <div className="kanban-schedule-list">
          <div className="kanban-schedule-list-header">
            <span>Task List</span>
          </div>
          {sortedScheduledTasks.length === 0 && (
            <div className="kanban-column-empty kanban-schedule-empty-list">
              <span className="kanban-terminal-prefix">&gt;</span>
              No scheduled tasks yet
            </div>
          )}
          <div className="kanban-schedule-card-grid">
            {sortedScheduledTasks.map((task) => (
              <div
                key={task.id}
                className={`kanban-schedule-item ${selectedScheduleId === task.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedScheduleId(task.id);
                }}
              >
                <div className="kanban-schedule-item-header">
                  <span className="kanban-schedule-item-title">{task.name}</span>
                  <span className={`kanban-badge ${task.enabled ? 'awaiting_review' : 'idle'}`}>{task.enabled ? 'enabled' : 'paused'}</span>
                </div>
                <div className="kanban-schedule-item-command">{task.command}</div>
                <div className="kanban-schedule-item-times">
                  <span>{formatScheduleSummary(task)}</span>
                  <span>Next {formatTime(task.nextRunAt) || 'manual'}</span>
                </div>
                <div className="kanban-schedule-item-actions">
                  <button type="button" className="kanban-template-btn" onClick={(e) => {
                    e.stopPropagation();
                    handleEditScheduledTask(task);
                  }}>Edit</button>
                  <button type="button" className="kanban-template-btn" onClick={async (e) => {
                    e.stopPropagation();
                    await onRunScheduledTaskNow(task.id);
                  }}>Run Now</button>
                  <button type="button" className="kanban-template-btn schedule-delete-btn" onClick={async (e) => {
                    e.stopPropagation();
                    await handleDeleteScheduledTaskClick(task.id);
                  }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="kanban-workspace">
      <div className={`kanban-sidebar-shell ${kanbanState.sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="kanban-sidebar-divider-hitbox">
          <button
            type="button"
            className="kanban-sidebar-toggle kanban-sidebar-close-toggle"
            aria-label="Close kanban sidebar"
            onClick={() => onSetSidebarCollapsed(true)}
          >
            &lt;
          </button>
        </div>
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
          <button
            className={`kanban-sidebar-item ${kanbanState.selectedView === 'schedules' ? 'active' : ''}`}
            onClick={() => onChangeSelectedView('schedules')}
          >
            Schedules
          </button>
        </aside>
      </div>
      {kanbanState.sidebarCollapsed && (
        <div className="kanban-sidebar-reopen-hitbox">
          <button
            type="button"
            className="kanban-sidebar-toggle kanban-sidebar-open-toggle"
            aria-label="Open kanban sidebar"
            onClick={() => onSetSidebarCollapsed(false)}
          >
            &gt;
          </button>
        </div>
      )}

      <div className="kanban-content">
        {kanbanState.selectedView === 'agents'
          ? renderAgents()
          : kanbanState.selectedView === 'schedules'
            ? renderSchedules()
            : renderBoard()}
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
            <div className="kanban-modal-header">
              <div>
                <h3>Create Task</h3>
                <p>Queue a new Kanban task with the same modal framing used across Swarm and Mux.</p>
              </div>
              <button className="config-close" onClick={() => setShowTaskComposer(false)}>×</button>
            </div>
            <form className="kanban-form" onSubmit={handleCreateTask}>
              <div className="kanban-modal-body">
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
              </div>
              <div className="kanban-modal-footer config-confirm-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowTaskComposer(false)}>Cancel</button>
                <button type="submit" className="btn-confirm">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showScheduleEditor && (
        <div className="config-confirm-overlay kanban-schedule-editor-overlay" onClick={handleCloseScheduleEditor}>
          <div
            className="kanban-modal kanban-schedule-editor-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ transform: `translate(${scheduleModalOffset.x}px, ${scheduleModalOffset.y}px)` }}
          >
            <div className="kanban-modal-header kanban-schedule-editor-header" onMouseDown={handleScheduleModalDragStart}>
              <div>
                <h3>{editingScheduledTaskId ? 'Edit Schedule' : 'New Schedule'}</h3>
                <p>{editingScheduledTaskId ? 'Update the selected scheduled task.' : 'Create a new scheduled task for this workspace.'}</p>
              </div>
              <button type="button" className="config-close" onClick={handleCloseScheduleEditor}>×</button>
            </div>
            <form className="kanban-form kanban-schedule-form" onSubmit={handleSubmitScheduledTask}>
              <div className="kanban-modal-body">
                <div className="kanban-schedule-form-header">
                  <label className="kanban-schedule-checkbox">
                    <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
                    <span>Enabled</span>
                  </label>
                </div>
                <div className="kanban-schedule-form-grid">
                  <div className="kanban-schedule-field">
                    <label>Name</label>
                    <input value={scheduleName} onChange={(e) => setScheduleName(e.target.value)} />
                  </div>
                  <div className="kanban-schedule-field">
                    <label>Run Type</label>
                    <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value)}>
                      <option value="once">One Time</option>
                      <option value="interval">Recurring</option>
                    </select>
                  </div>
                </div>
                <div className="kanban-schedule-field">
                  <label>CLI Command</label>
                  <textarea rows={7} value={scheduleCommand} onChange={(e) => setScheduleCommand(e.target.value)} />
                </div>
                {scheduleType === 'once' ? (
                  <div className="kanban-schedule-field">
                    <label>Run At</label>
                    <input
                      type="datetime-local"
                      lang="en-US"
                      value={scheduleRunAt}
                      onChange={(e) => setScheduleRunAt(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="kanban-schedule-interval-row">
                    <div className="kanban-schedule-field">
                      <label>Every</label>
                      <input type="number" min="1" value={scheduleIntervalValue} onChange={(e) => setScheduleIntervalValue(e.target.value)} />
                    </div>
                    <div className="kanban-schedule-field">
                      <label>Unit</label>
                      <select value={scheduleIntervalUnit} onChange={(e) => setScheduleIntervalUnit(e.target.value)}>
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                      </select>
                    </div>
                  </div>
                )}
                <div className="kanban-schedule-summary">
                  <div className="kanban-run-section-label">Current Selection</div>
                  <div className="kanban-schedule-summary-grid">
                    <span>{scheduleName.trim() || 'Untitled schedule'}</span>
                    <span>{scheduleType === 'once' ? 'One Time' : `Every ${scheduleIntervalValue || 1} ${scheduleIntervalUnit}`}</span>
                    <span>{scheduleType === 'once' ? (scheduleRunAt ? formatTime(new Date(scheduleRunAt).toISOString()) : 'No time selected') : (scheduleEnabled ? 'Auto-run enabled' : 'Paused')}</span>
                  </div>
                </div>
              </div>
              <div className="kanban-modal-footer config-confirm-actions">
                <button type="button" className="btn-cancel" onClick={handleCloseScheduleEditor}>Cancel</button>
                <button type="button" className="btn-cancel" onClick={resetScheduledTaskForm}>Reset</button>
                <button type="submit" className="btn-confirm">{editingScheduledTaskId ? 'Save' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTask && (
        <div className="config-confirm-overlay kanban-task-modal-overlay" onClick={() => setActiveTaskId(null)}>
          <div
            className="kanban-modal kanban-task-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ transform: `translate(${taskModalOffset.x}px, ${taskModalOffset.y}px)` }}
          >
            <div className="kanban-modal-header kanban-task-modal-header" onMouseDown={handleTaskModalDragStart}>
              <div>
                <h3>{activeTask.title}</h3>
                <p>{activeTask.runStatus === 'running' ? 'Task is processing in the background.' : 'Review the full run history or send follow-up feedback.'}</p>
              </div>
              <button className="config-close" onClick={() => setActiveTaskId(null)}>×</button>
            </div>
            <div className="kanban-task-modal-body">
              <div className="kanban-task-runs">
                {(activeTask.runs || []).slice().reverse().map((run, index) => (
                  (() => {
                    const scheduledRunLog = getScheduledRunLog(activeTask, run, kanbanState.scheduledTasks || []);
                    const scheduledOutput = scheduledRunLog?.output || scheduledRunLog?.stdout || scheduledRunLog?.stderr || '';
                    const hasScheduledOutput = Boolean((run.output || run.stdout || run.stderr || scheduledOutput || '').trim());

                    return (
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
                        {run.renderMode !== 'timeline' && (hasVisibleTranscript(run) || (activeTask.targetType === 'scheduled' && hasScheduledOutput)) && (
                        <div className="kanban-run-section">
                          <div className="kanban-run-section-label">{activeTask.targetType === 'scheduled' ? 'Command Output' : 'Live Transcript'}</div>
                          {activeTask.targetType === 'scheduled' ? (
                            <pre>{run.output || run.stdout || run.stderr || scheduledOutput || '$ No command output captured.'}</pre>
                          ) : (
                            <KanbanTranscriptTerminal
                              sessionKey={run.id}
                              transcript={run.transcript || ''}
                            />
                          )}
                        </div>
                        )}
                        {!run.reply && activeTask.targetType !== 'scheduled' && (
                        <div className="kanban-run-section">
                          <div className="kanban-run-section-label">Prompt</div>
                          <pre>{run.displayPrompt || activeTask.prompt}</pre>
                        </div>
                        )}
                        {run.reply && activeTask.targetType !== 'scheduled' && (
                        <div className="kanban-run-section">
                          <div className="kanban-run-section-label">Reviewer Feedback</div>
                          <pre>{run.reply}</pre>
                        </div>
                        )}
                        {run.finalResponse && activeTask.targetType !== 'scheduled' && (
                        <div className="kanban-run-section">
                          <div className="kanban-run-section-label">Reply</div>
                          <pre>{run.finalResponse}</pre>
                        </div>
                        )}
                        {activeTask.targetType === 'scheduled' && (
                        <>
                          <div className="kanban-run-section">
                            <div className="kanban-run-section-label">Command</div>
                            <pre>{run.displayPrompt || activeTask.prompt}</pre>
                          </div>
                          <div className="kanban-run-section">
                            <div className="kanban-run-section-label">Result</div>
                            <pre>{run.finalResponse || 'Command is still running.'}</pre>
                          </div>
                        </>
                        )}
                        {run.renderMode !== 'timeline' && !hasVisibleTranscript(run) && activeTask.targetType !== 'scheduled' && (run.segments || []).map((segment) => (
                        <div key={segment.id} className="kanban-run-segment">
                          <div className="kanban-run-segment-header">{segment.agentName}</div>
                          <pre>{segment.text}</pre>
                        </div>
                        ))}
                        {!run.finalResponse && run.renderMode === 'timeline' && !hasVisibleTimeline(run) && (
                        <div className="kanban-run-empty">No response yet. Waiting for the agent to emit structured progress.</div>
                        )}
                        {!run.finalResponse && run.renderMode !== 'timeline' && activeTask.targetType !== 'scheduled' && !hasVisibleTranscript(run) && (!run.segments || run.segments.length === 0) && (
                        <div className="kanban-run-empty">No streamed terminal output was captured for this run.</div>
                        )}
                        {activeTask.targetType === 'scheduled' && !hasScheduledOutput && (
                        <div className="kanban-run-empty">No command output was captured for this run.</div>
                        )}
                      </div>
                    </details>
                    );
                  })()
                ))}
              </div>
              {activeTask.lastError && <div className="kanban-error-banner">{activeTask.lastError}</div>}
              {activeTask.stage === 'in_review' && activeTask.targetType !== 'scheduled' && (
                <div className="kanban-review-box">
                  <label>Reply</label>
                  <textarea rows={5} value={reviewReply} onChange={(e) => setReviewReply(e.target.value)} />
                  <div className="kanban-modal-footer config-confirm-actions">
                    <button className="btn-delete" onClick={() => onDeleteTask(activeTask.id)}>Delete</button>
                    <button className="btn-cancel" onClick={handleMarkDone}>Mark Done</button>
                    <button className="btn-confirm" onClick={handleReply}>Send Reply</button>
                  </div>
                </div>
              )}
              {activeTask.stage === 'in_review' && activeTask.targetType === 'scheduled' && (
                <div className="kanban-modal-footer config-confirm-actions">
                  <button className="btn-delete" onClick={() => onDeleteTask(activeTask.id)}>Delete</button>
                  <button className="btn-confirm" onClick={handleMarkDone}>Mark Done</button>
                </div>
              )}
              {activeTask.stage !== 'in_review' && activeTask.runStatus !== 'running' && (
                <div className="kanban-modal-footer config-confirm-actions">
                  <button className="btn-delete" onClick={() => onDeleteTask(activeTask.id)}>Delete</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default KanbanWorkspace;
