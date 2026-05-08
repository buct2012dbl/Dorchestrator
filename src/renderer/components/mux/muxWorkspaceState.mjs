import { normalizeMuxTemplate } from './templateConfig.mjs';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function templatesDiffer(template, normalizedTemplate) {
  return JSON.stringify(template) !== JSON.stringify(normalizedTemplate);
}

export function prepareMuxWorkspaceState({
  loadedTemplates = [],
  savedId = null,
  defaultTemplates = [],
} = {}) {
  const persistedTemplates = Array.isArray(loadedTemplates) ? loadedTemplates : [];
  const shouldBootstrapDefaults = persistedTemplates.length === 0;
  const sourceTemplates = shouldBootstrapDefaults ? defaultTemplates : persistedTemplates;
  const finalTemplates = sourceTemplates.map(normalizeMuxTemplate).filter(Boolean);
  const templatesToSave = shouldBootstrapDefaults
    ? finalTemplates
    : persistedTemplates
      .map((template, index) => ({ template, normalizedTemplate: finalTemplates[index] }))
      .filter(({ template, normalizedTemplate }) => normalizedTemplate && templatesDiffer(template, normalizedTemplate))
      .map(({ normalizedTemplate }) => normalizedTemplate);

  const normalizedSavedId = isNonEmptyString(savedId) ? savedId : null;
  const savedTemplateExists = normalizedSavedId
    ? finalTemplates.some((template) => template.id === normalizedSavedId)
    : false;
  const nextSelectedTemplate = savedTemplateExists
    ? normalizedSavedId
    : (finalTemplates[0]?.id || null);
  const shouldPersistSelectedTemplate = nextSelectedTemplate !== normalizedSavedId;

  return {
    finalTemplates,
    nextSelectedTemplate,
    templatesToSave,
    shouldPersistSelectedTemplate,
    selectedTemplateToPersist: nextSelectedTemplate,
  };
}
