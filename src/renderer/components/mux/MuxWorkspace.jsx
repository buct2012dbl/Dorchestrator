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

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.loadMuxTemplates().then(loadedTemplates => {
      if (loadedTemplates.length === 0) {
        setTemplates(DEFAULT_TEMPLATES);
        DEFAULT_TEMPLATES.forEach(t => window.electronAPI.saveMuxTemplate(t));
      } else {
        setTemplates(loadedTemplates);
      }
    });
  }, []);

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

  const handleDeleteTemplate = (id) => {
    if (confirm('Delete this template?')) {
      window.electronAPI.deleteMuxTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (selectedTemplate === id) {
        setSelectedTemplate(null);
      }
    }
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const handleSaveAsTemplate = () => {
    setEditingTemplate(null);
    setShowEditor(true);
  };

  const currentTemplate = templates.find(t => t.id === selectedTemplate);

  return (
    <div className="mux-workspace">
      <MuxSidebar
        templates={templates}
        selectedTemplate={selectedTemplate}
        onSelectTemplate={setSelectedTemplate}
        onNewTemplate={handleNewTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />
      <MuxTerminalView
        template={currentTemplate}
        onSaveAsTemplate={handleSaveAsTemplate}
      />
      {showEditor && (
        <TemplateEditorModal
          template={editingTemplate}
          onSave={handleSaveTemplate}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}

export default MuxWorkspace;
