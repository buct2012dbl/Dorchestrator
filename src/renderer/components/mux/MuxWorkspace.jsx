import React, { useState, useEffect } from 'react';
import MuxSidebar from './MuxSidebar';
import MuxTerminalView from './MuxTerminalView';
import TemplateEditorModal from './TemplateEditorModal';
import { DEFAULT_TEMPLATES } from '../../store/defaultTemplates';
import './MuxWorkspace.css';

function MuxWorkspace({ onActiveTerminalChange }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [visitedTemplateIds, setVisitedTemplateIds] = useState([]);

  useEffect(() => {
    if (!window.electronAPI) return;

    let cancelled = false;

    Promise.all([
      window.electronAPI.loadMuxTemplates(),
      window.electronAPI.getSelectedMuxTemplate(),
      window.electronAPI.getMuxUiState(),
    ]).then(([loadedTemplates, savedId, savedUiState]) => {
      if (cancelled) {
        return;
      }

      let finalTemplates;
      if (loadedTemplates.length === 0) {
        finalTemplates = DEFAULT_TEMPLATES;
        DEFAULT_TEMPLATES.forEach((t) => window.electronAPI.saveMuxTemplate(t));
      } else {
        finalTemplates = loadedTemplates;
      }

      const nextSelectedTemplate = savedId && finalTemplates.find((t) => t.id === savedId)
        ? savedId
        : finalTemplates[0]?.id || null;

      setTemplates(finalTemplates);
      setSelectedTemplate(nextSelectedTemplate);
      setVisitedTemplateIds(nextSelectedTemplate ? [nextSelectedTemplate] : []);
      setIsSidebarCollapsed(Boolean(savedUiState?.sidebarCollapsed));
    }).catch((err) => {
      console.error('[MuxWorkspace] Failed to load workspace state:', err);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedTemplate) return;
    setVisitedTemplateIds((prev) => (
      prev.includes(selectedTemplate) ? prev : [...prev, selectedTemplate]
    ));
  }, [selectedTemplate]);

  useEffect(() => {
    setVisitedTemplateIds((prev) => prev.filter((id) => templates.some((template) => template.id === id)));
  }, [templates]);

  const handleSaveTemplate = (template) => {
    const isNewTemplate = !templates.some((item) => item.id === template.id);

    window.electronAPI.saveMuxTemplate(template);
    setTemplates(prev => {
      const existing = prev.find(t => t.id === template.id);
      if (existing) {
        return prev.map(t => t.id === template.id ? template : t);
      }
      return [...prev, template];
    });

    if (isNewTemplate) {
      setSelectedTemplate(template.id);
      setVisitedTemplateIds((prev) => (
        prev.includes(template.id) ? prev : [...prev, template.id]
      ));
      window.electronAPI.setSelectedMuxTemplate(template.id);
    }

    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handlePersistRuntimeLayout = (templateId, runtimeLayout) => {
    setTemplates((prev) => {
      const nextTemplates = prev.map((template) => (
        template.id === templateId
          ? { ...template, runtimeLayout }
          : template
      ));

      const nextTemplate = nextTemplates.find((template) => template.id === templateId);
      if (nextTemplate) {
        window.electronAPI.saveMuxTemplate(nextTemplate);
      }

      return nextTemplates;
    });
  };

  const handleResetRuntimeLayout = (templateId) => {
    setTemplates((prev) => {
      const nextTemplates = prev.map((template) => {
        if (template.id !== templateId || !template.runtimeLayout) {
          return template;
        }

        const { runtimeLayout, ...rest } = template;
        return rest;
      });

      const nextTemplate = nextTemplates.find((template) => template.id === templateId);
      if (nextTemplate) {
        window.electronAPI.saveMuxTemplate(nextTemplate);
      }

      return nextTemplates;
    });
  };

  const handleSelectTemplate = (id) => {
    setSelectedTemplate(id);
    if (window.electronAPI) {
      window.electronAPI.setSelectedMuxTemplate(id);
    }
  };

  const handleSetSidebarCollapsed = (collapsed) => {
    setIsSidebarCollapsed(collapsed);
    window.electronAPI?.setMuxUiState({ sidebarCollapsed: collapsed });
  };

  const handleDeleteTemplate = (id) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    window.electronAPI.deleteMuxTemplate(deleteId);
    setTemplates(prev => prev.filter(t => t.id !== deleteId));
    if (selectedTemplate === deleteId) {
      setSelectedTemplate(null);
    }
    setShowDeleteConfirm(false);
    setDeleteId(null);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleEditTemplate = () => {
    setEditingTemplate(currentTemplate);
    setShowEditor(true);
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplate);
  const visibleTemplates = visitedTemplateIds
    .map((id) => templates.find((template) => template.id === id))
    .filter(Boolean);

  return (
    <div className="mux-workspace">
      <div className={`mux-sidebar-shell ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="mux-sidebar-divider-hitbox">
          <button
            type="button"
            className="mux-sidebar-toggle mux-sidebar-close-toggle"
            aria-label="Close templates sidebar"
            onClick={() => handleSetSidebarCollapsed(true)}
          >
            &lt;
          </button>
        </div>
        <div className="mux-sidebar-panel">
          <MuxSidebar
            templates={templates}
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleSelectTemplate}
            onNewTemplate={handleNewTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        </div>
      </div>
      {isSidebarCollapsed && (
        <div className="mux-sidebar-reopen-hitbox">
          <button
            type="button"
            className="mux-sidebar-toggle mux-sidebar-open-toggle"
            aria-label="Open templates sidebar"
            onClick={() => handleSetSidebarCollapsed(false)}
          >
            &gt;
          </button>
        </div>
      )}
      {visibleTemplates.length > 0 ? (
        visibleTemplates.map((template) => (
          <MuxTerminalView
            key={template.id}
            template={template}
            active={template.id === selectedTemplate}
            onEditTemplate={handleEditTemplate}
            onPersistRuntimeLayout={handlePersistRuntimeLayout}
            onResetRuntimeLayout={handleResetRuntimeLayout}
            onActiveTerminalChange={template.id === selectedTemplate ? onActiveTerminalChange : undefined}
          />
        ))
      ) : (
        <MuxTerminalView
          template={currentTemplate}
          active
          onEditTemplate={handleEditTemplate}
          onPersistRuntimeLayout={handlePersistRuntimeLayout}
          onResetRuntimeLayout={handleResetRuntimeLayout}
          onActiveTerminalChange={onActiveTerminalChange}
        />
      )}
      {showEditor && (
        <TemplateEditorModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => setShowEditor(false)}
        />
      )}
      {showDeleteConfirm && (
        <div className="config-confirm-overlay">
          <div className="config-confirm-dialog">
            <h4>Delete this template?</h4>
            <div className="config-confirm-actions">
              <button className="btn-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="btn-confirm" onClick={confirmDelete}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MuxWorkspace;
