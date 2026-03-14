export interface ActivityEntry {
  time: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

const MAX_ENTRIES = 100;
const entries: ActivityEntry[] = [];

export function logActivity(level: ActivityEntry['level'], message: string) {
  entries.push({
    time: new Date().toISOString(),
    level,
    message,
  });
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }
}

export function getActivityLog(since?: string): ActivityEntry[] {
  if (!since) return [...entries];
  return entries.filter((e) => e.time > since);
}

export function info(msg: string) { logActivity('info', msg); }
export function warn(msg: string) { logActivity('warn', msg); }
export function error(msg: string) { logActivity('error', msg); }
