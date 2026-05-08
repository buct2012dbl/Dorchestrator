import test from 'node:test';
import assert from 'node:assert/strict';

import { prepareMuxWorkspaceState } from '../../src/renderer/components/mux/muxWorkspaceState.mjs';

test('prepareMuxWorkspaceState normalizes and persists bootstrapped default templates and selection', () => {
  const defaultTemplates = [
    {
      id: 'default-a',
      name: 'Default A',
      layout: {
        rows: 1,
        cols: 1,
        terminals: [
          { id: 'terminal-a', row: 0, col: 0, config: { cliType: 'empty', model: 'unused', name: 'Legacy Empty' } },
        ],
      },
    },
  ];

  const result = prepareMuxWorkspaceState({
    loadedTemplates: [],
    savedId: null,
    defaultTemplates,
  });

  assert.equal(result.nextSelectedTemplate, 'default-a');
  assert.equal(result.shouldPersistSelectedTemplate, true);
  assert.equal(result.selectedTemplateToPersist, 'default-a');
  assert.deepEqual(result.finalTemplates[0].layout.terminals[0].config, {
    cliType: 'shell',
    model: '',
    name: 'Legacy Empty',
  });
  assert.deepEqual(result.templatesToSave, result.finalTemplates);
});

test('prepareMuxWorkspaceState keeps a valid persisted selection without rewriting it', () => {
  const loadedTemplates = [
    { id: 'template-a', name: 'A', layout: { rows: 1, cols: 1, terminals: [] } },
    { id: 'template-b', name: 'B', layout: { rows: 1, cols: 1, terminals: [] } },
  ];

  const result = prepareMuxWorkspaceState({
    loadedTemplates,
    savedId: 'template-b',
    defaultTemplates: [],
  });

  assert.equal(result.nextSelectedTemplate, 'template-b');
  assert.equal(result.shouldPersistSelectedTemplate, false);
  assert.deepEqual(result.templatesToSave, []);
});

test('prepareMuxWorkspaceState replaces a stale persisted selection with the first available template', () => {
  const loadedTemplates = [
    { id: 'template-a', name: 'A', layout: { rows: 1, cols: 1, terminals: [] } },
  ];

  const result = prepareMuxWorkspaceState({
    loadedTemplates,
    savedId: 'deleted-template',
    defaultTemplates: [],
  });

  assert.equal(result.nextSelectedTemplate, 'template-a');
  assert.equal(result.shouldPersistSelectedTemplate, true);
  assert.equal(result.selectedTemplateToPersist, 'template-a');
});
