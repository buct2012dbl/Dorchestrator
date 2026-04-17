export interface CliTimelineEvent {
  kind: 'assistant' | 'command' | 'error';
  phase?: 'running' | 'completed';
  title: string;
  text?: string;
}

const OSC_EVENT_PREFIX = '\u001b]777;AO_KANBAN_EVENT:';
const OSC_EVENT_SUFFIX = '\u0007';
const MAX_TEXT_LENGTH = 4000;

function compactValue(value: unknown): string {
  if (value == null) return '';

  const text = typeof value === 'string'
    ? value
    : JSON.stringify(value, null, 2);

  if (text.length <= MAX_TEXT_LENGTH) {
    return text;
  }

  return `${text.slice(0, MAX_TEXT_LENGTH - 1)}…`;
}

export function emitCliTimelineEvent(event: CliTimelineEvent): void {
  const payload = {
    kind: event.kind,
    phase: event.phase || 'completed',
    title: event.title,
    text: compactValue(event.text || ''),
  };

  process.stdout.write(
    `${OSC_EVENT_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}${OSC_EVENT_SUFFIX}`,
  );
}
