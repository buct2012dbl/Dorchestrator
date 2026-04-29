const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const templateManager = require('../../src/main/templateManager');

function createWorkspace() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'dorchestrator-template-manager-'));
}

function writeTemplates(workspacePath, templates) {
  templateManager.setWorkspace(workspacePath);
  for (const template of templates) {
    const saved = templateManager.saveTemplate(template);
    assert.equal(saved, true);
  }
}

function readSelectedTemplateFile(workspacePath) {
  const selectedPath = path.join(workspacePath, '.dorchestrator', 'selected-template.json');
  return JSON.parse(fs.readFileSync(selectedPath, 'utf8'));
}

test('deleteTemplate switches persisted selection to the first remaining template when the selected template is removed', () => {
  const workspacePath = createWorkspace();

  writeTemplates(workspacePath, [
    { id: 'template-a', name: 'A', layout: { rows: 1, cols: 1, terminals: [] } },
    { id: 'template-b', name: 'B', layout: { rows: 1, cols: 1, terminals: [] } },
  ]);
  assert.equal(templateManager.setSelectedTemplateId('template-a'), true);

  const result = templateManager.deleteTemplate('template-a');

  assert.equal(result.success, true);
  assert.equal(result.selectedTemplateId, 'template-b');
  assert.equal(templateManager.getSelectedTemplateId(), 'template-b');
  assert.deepEqual(readSelectedTemplateFile(workspacePath), { selectedTemplateId: 'template-b' });
  assert.deepEqual(
    templateManager.loadTemplates().map((template) => template.id),
    ['template-b'],
  );

  templateManager.setWorkspace(null);
  fs.rmSync(workspacePath, { recursive: true, force: true });
});

test('deleteTemplate preserves persisted selection when deleting a different template', () => {
  const workspacePath = createWorkspace();

  writeTemplates(workspacePath, [
    { id: 'template-a', name: 'A', layout: { rows: 1, cols: 1, terminals: [] } },
    { id: 'template-b', name: 'B', layout: { rows: 1, cols: 1, terminals: [] } },
  ]);
  assert.equal(templateManager.setSelectedTemplateId('template-b'), true);

  const result = templateManager.deleteTemplate('template-a');

  assert.equal(result.success, true);
  assert.equal(result.selectedTemplateId, 'template-b');
  assert.equal(templateManager.getSelectedTemplateId(), 'template-b');
  assert.deepEqual(readSelectedTemplateFile(workspacePath), { selectedTemplateId: 'template-b' });

  templateManager.setWorkspace(null);
  fs.rmSync(workspacePath, { recursive: true, force: true });
});
