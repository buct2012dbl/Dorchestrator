import React, { useState, useEffect } from 'react';
import MuxSidebar from './MuxSidebar';
import MuxTerminalView from './MuxTerminalView';
import TemplateEditorModal from './TemplateEditorModal';
import { DEFAULT_TEMPLATES } from '../../store/defaultTemplates';
import './MuxWorkspace.css';

function MuxWorkspace() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [visitedTemplateIds, setVisitedTemplateIds] = useState([]);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.loadMuxTemplates().then(loadedTemplates => {
      let finalTemplates;
      if (loadedTemplates.length === 0) {
        finalTemplates = DEFAULT_TEMPLATES;
        DEFAULT_TEMPLATES.forEach(t => window.electronAPI.saveMuxTemplate(t));
      } else {
        finalTemplates = loadedTemplates;
      }
      setTemplates(finalTemplates);

      window.electronAPI.getSelectedMuxTemplate().then(savedId => {
        if (savedId && finalTemplates.find(t => t.id === savedId)) {
          setSelectedTemplate(savedId);
          setVisitedTemplateIds([savedId]);
        }
      });
    });
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
    window.electronAPI.saveMuxTemplate(template);
    setTemplates(prev => {
      const existing = prev.find(t => t.id === template.id);
      if (existing) {
        return prev.map(t => t.id === template.id ? template : t);
      }
      return [...prev, template];
    });
    setShowEditor(false);
    setEditingTemplate(null);
  };

  const handleSelectTemplate = (id) => {
    setSelectedTemplate(id);
    if (window.electronAPI) {
      window.electronAPI.setSelectedMuxTemplate(id);
    }
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
      <MuxSidebar
        templates={templates}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={handleSelectTemplate}
        onNewTemplate={handleNewTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />
      {visibleTemplates.length > 0 ? (
        visibleTemplates.map((template) => (
          <MuxTerminalView
            key={template.id}
            template={template}
            active={template.id === selectedTemplate}
            onEditTemplate={handleEditTemplate}
          />
        ))
      ) : (
        <MuxTerminalView
          template={currentTemplate}
          active
          onEditTemplate={handleEditTemplate}
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
