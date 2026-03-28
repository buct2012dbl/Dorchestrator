const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth configuration
  configure: (data) => ipcRenderer.invoke('configure', data),
  isConfigured: () => ipcRenderer.invoke('is-configured'),

  // Sync agent/edge config to main process
  syncAgents: (data) => ipcRenderer.invoke('sync-agents', data),

  // Send a user message to an agent
  sendMessage: (data) => ipcRenderer.invoke('send-message', data),

  // Clear history
  clearHistory: (data) => ipcRenderer.invoke('clear-history', data),

  // Listen for streaming events from main process
  onAgentStream: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('agent-stream', listener);
    return () => ipcRenderer.removeListener('agent-stream', listener);
  },
  onAgentDone: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('agent-done', listener);
    return () => ipcRenderer.removeListener('agent-done', listener);
  },
  onAgentError: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('agent-error', listener);
    return () => ipcRenderer.removeListener('agent-error', listener);
  },
  onAgentStatus: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('agent-status', listener);
    return () => ipcRenderer.removeListener('agent-status', listener);
  },
  onAgentMessageSent: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('agent-message-sent', listener);
    return () => ipcRenderer.removeListener('agent-message-sent', listener);
  },

  // Workspace
  getWorkspace: () => ipcRenderer.invoke('get-workspace'),
  setWorkspace: (data) => ipcRenderer.invoke('set-workspace', data),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  loadGraphConfig: () => ipcRenderer.invoke('load-graph-config'),

  // PTY (claude CLI sessions)
  spawnAgent: (data) => ipcRenderer.invoke('pty-spawn', data),
  ptyInput: (data) => ipcRenderer.send('pty-input', data),
  ptyResize: (data) => ipcRenderer.invoke('pty-resize', data),
  killAgent: (data) => ipcRenderer.invoke('pty-kill', data),
  onPtyData: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('pty-data', listener);
    return () => ipcRenderer.removeListener('pty-data', listener);
  },
  onPtyExit: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('pty-exit', listener);
    return () => ipcRenderer.removeListener('pty-exit', listener);
  },
  onAgentNotification: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('agent-notification', listener);
    return () => ipcRenderer.removeListener('agent-notification', listener);
  },

  // Mux mode templates
  loadMuxTemplates: () => ipcRenderer.invoke('load-mux-templates'),
  saveMuxTemplate: (template) => ipcRenderer.invoke('save-mux-template', template),
  deleteMuxTemplate: (id) => ipcRenderer.invoke('delete-mux-template', id),
  getSelectedMuxTemplate: () => ipcRenderer.invoke('get-selected-mux-template'),
  setSelectedMuxTemplate: (id) => ipcRenderer.invoke('set-selected-mux-template', id),

  // Mux mode PTY
  spawnMuxTerminal: (data) => ipcRenderer.invoke('mux-pty-spawn', data),
  muxPtyInput: (data) => ipcRenderer.send('mux-pty-input', data),
  muxPtyResize: (data) => ipcRenderer.invoke('mux-pty-resize', data),
  killMuxTerminal: (data) => ipcRenderer.invoke('mux-pty-kill', data),
  onMuxPtyData: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('mux-pty-data', listener);
    return () => ipcRenderer.removeListener('mux-pty-data', listener);
  },
  onMuxPtyExit: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('mux-pty-exit', listener);
    return () => ipcRenderer.removeListener('mux-pty-exit', listener);
  },

  // Whisper voice recognition
  whisperCheckModel: () => ipcRenderer.invoke('whisper:checkModel'),
  whisperDownloadModel: (modelSize) => ipcRenderer.invoke('whisper:downloadModel', modelSize),
  whisperTranscribe: (audioPath) => ipcRenderer.invoke('whisper:transcribe', audioPath),
  whisperTranscribeBlob: (audioBuffer) => ipcRenderer.invoke('whisper:transcribeBlob', audioBuffer),
  whisperInstallWhisper: () => ipcRenderer.invoke('whisper:installWhisper'),
  onWhisperDownloadProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('whisper:downloadProgress', listener);
    return () => ipcRenderer.removeListener('whisper:downloadProgress', listener);
  },
});
