export const DEFAULT_TEMPLATES = [
  {
    id: 'default-2x2',
    name: '2×2 Grid',
    layout: {
      rows: 2,
      cols: 2,
      terminals: [
        { id: 't1', row: 0, col: 0, config: { cliType: 'claude-code', model: 'claude-sonnet-4-6', name: 'Claude 1', systemPrompt: '' } },
        { id: 't2', row: 0, col: 1, config: { cliType: 'codex', model: 'gpt-5.4', name: 'Codex', systemPrompt: '' } },
        { id: 't3', row: 1, col: 0, config: { cliType: 'shell', name: 'Shell', systemPrompt: '' } },
        { id: 't4', row: 1, col: 1, config: { cliType: 'empty', name: 'Empty', systemPrompt: '' } }
      ]
    }
  },
  {
    id: 'default-3col',
    name: '3 Columns',
    layout: {
      rows: 1,
      cols: 3,
      terminals: [
        { id: 't1', row: 0, col: 0, config: { cliType: 'claude-code', model: 'claude-sonnet-4-6', name: 'Claude', systemPrompt: '' } },
        { id: 't2', row: 0, col: 1, config: { cliType: 'codex', model: 'gpt-5.4', name: 'Codex', systemPrompt: '' } },
        { id: 't3', row: 0, col: 2, config: { cliType: 'shell', name: 'Shell', systemPrompt: '' } }
      ]
    }
  },
  {
    id: 'default-single',
    name: 'Single Terminal',
    layout: {
      rows: 1,
      cols: 1,
      terminals: [
        { id: 't1', row: 0, col: 0, config: { cliType: 'claude-code', model: 'claude-sonnet-4-6', name: 'Claude', systemPrompt: '' } }
      ]
    }
  }
];
