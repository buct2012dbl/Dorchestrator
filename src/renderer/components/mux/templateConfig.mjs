import {
  getDefaultModelForTerminalType,
  getModelsForTerminalType,
} from '../../constants/models.js';

export const DEFAULT_MUX_CLI_TYPE = 'shell';

export function normalizeMuxCliType(cliType) {
  if (!cliType || cliType === 'empty') {
    return DEFAULT_MUX_CLI_TYPE;
  }

  return cliType;
}

export function normalizeMuxTerminalConfig(config = {}) {
  const cliType = normalizeMuxCliType(config.cliType);
  const normalized = {
    ...config,
    cliType,
  };

  if (cliType === 'shell') {
    normalized.model = '';
    return normalized;
  }

  const validModels = getModelsForTerminalType(cliType);
  if (!validModels.includes(normalized.model)) {
    normalized.model = getDefaultModelForTerminalType(cliType);
  }

  return normalized;
}

export function normalizeMuxTerminalRecord(terminal = {}) {
  return {
    ...terminal,
    config: normalizeMuxTerminalConfig(terminal.config),
  };
}

export function normalizeMuxTemplate(template) {
  if (!template) return template;

  return {
    ...template,
    layout: template.layout ? {
      ...template.layout,
      terminals: (template.layout.terminals || []).map(normalizeMuxTerminalRecord),
    } : template.layout,
    runtimeLayout: template.runtimeLayout ? {
      ...template.runtimeLayout,
      terminals: (template.runtimeLayout.terminals || []).map(normalizeMuxTerminalRecord),
    } : template.runtimeLayout,
  };
}
