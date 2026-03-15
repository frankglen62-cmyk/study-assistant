export type LogLevel = 'info' | 'warn' | 'error';

export function logEvent(level: LogLevel, event: string, context: Record<string, unknown>) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...context,
  };

  if (level === 'error') {
    console.error(payload);
    return;
  }

  if (level === 'warn') {
    console.warn(payload);
    return;
  }

  console.info(payload);
}
