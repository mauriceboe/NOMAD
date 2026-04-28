import cron, { type ScheduledTask } from 'node-cron';
import archiver from 'archiver';
import path from 'node:path';
import fs from 'node:fs';
import { logInfo, logError } from './services/auditLog';

const dataDir = path.join(__dirname, '../data');
const backupsDir = path.join(dataDir, 'backups');
const uploadsDir = path.join(__dirname, '../uploads');
const settingsFile = path.join(dataDir, 'backup-settings.json');

const VALID_INTERVALS = ['hourly', 'daily', 'weekly', 'monthly'];
const VALID_DAYS_OF_WEEK = new Set([0, 1, 2, 3, 4, 5, 6]); // 0=Sunday
const VALID_HOURS = new Set(Array.from({length: 24}, (_, i) => i));

interface BackupSettings {
  enabled: boolean;
  interval: string;
  keep_days: number;
  hour: number;
  day_of_week: number;
  day_of_month: number;
}

export function buildCronExpression(settings: BackupSettings): string {
  const hour = VALID_HOURS.has(settings.hour) ? settings.hour : 2;
  const dow = VALID_DAYS_OF_WEEK.has(settings.day_of_week) ? settings.day_of_week : 0;
  const dom = settings.day_of_month >= 1 && settings.day_of_month <= 28 ? settings.day_of_month : 1;

  switch (settings.interval) {
    case 'hourly':  return '0 * * * *';
    case 'daily':   return `0 ${hour} * * *`;
    case 'weekly':  return `0 ${hour} * * ${dow}`;
    case 'monthly': return `0 ${hour} ${dom} * *`;
    default:        return `0 ${hour} * * *`;
  }
}

let currentTask: ScheduledTask | null = null;

function getDefaults(): BackupSettings {
  return { enabled: false, interval: 'daily', keep_days: 7, hour: 2, day_of_week: 0, day_of_month: 1 };
}

function loadSettings(): BackupSettings {
  let settings = getDefaults();
  try {
    if (fs.existsSync(settingsFile)) {
      const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      settings = { ...settings, ...saved };
    }
  } catch (e) {}
  return settings;
}

function saveSettings(settings: BackupSettings): void {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
}

async function runBackup(): Promise<void> {
  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `auto-backup-${timestamp}.zip`;
  const outputPath = path.join(backupsDir, filename);

  try {
    // Flush WAL to main DB file before archiving
    try { const { db } = require('./db/database'); db.exec('PRAGMA wal_checkpoint(TRUNCATE)'); } catch (e) {}

    await new Promise<void>((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', resolve);
      archive.on('error', reject);
      archive.pipe(output);
      const dbPath = path.join(dataDir, 'travel.db');
      if (fs.existsSync(dbPath)) archive.file(dbPath, { name: 'travel.db' });
      if (fs.existsSync(uploadsDir)) archive.directory(uploadsDir, 'uploads');
      archive.finalize();
    });
    logInfo(`Auto-Backup created: ${filename}`);
  } catch (err: unknown) {
    logError(`Auto-Backup: ${err instanceof Error ? err.message : err}`);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return;
  }

  const settings = loadSettings();
  if (settings.keep_days > 0) {
    cleanupOldBackups(settings.keep_days);
  }
}

function autoBackupTimestampMs(filename: string): number | null {
  // auto-backup-2026-04-27T00-00-00.zip → 2026-04-27T00:00:00
  const stamp = filename.slice('auto-backup-'.length, -'.zip'.length);
  const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3');
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

export function cleanupOldBackups(keepDays: number, now: number = Date.now()): void {
  try {
    const cutoff = now - keepDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(backupsDir).filter(f => f.startsWith('auto-backup-') && f.endsWith('.zip'));
    for (const file of files) {
      const filePath = path.join(backupsDir, file);
      const ageMs = autoBackupTimestampMs(file) ?? fs.statSync(filePath).mtimeMs;
      if (ageMs < cutoff) {
        fs.unlinkSync(filePath);
        logInfo(`Auto-Backup old backup deleted: ${file}`);
      }
    }
  } catch (err: unknown) {
    logError(`Auto-Backup cleanup: ${err instanceof Error ? err.message : err}`);
  }
}

function start(): void {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const settings = loadSettings();
  if (!settings.enabled) {
    logInfo('Auto-Backup disabled');
    return;
  }

  const expression = buildCronExpression(settings);
  const tz = process.env.TZ || 'UTC';
  currentTask = cron.schedule(expression, runBackup, { timezone: tz });
  logInfo(`Auto-Backup scheduled: ${settings.interval} (${expression}), tz: ${tz}, retention: ${settings.keep_days === 0 ? 'forever' : settings.keep_days + ' days'}`);
}

// Demo mode: hourly reset of demo user data
let demoTask: ScheduledTask | null = null;

function startDemoReset(): void {
  if (demoTask) { demoTask.stop(); demoTask = null; }
  if (process.env.DEMO_MODE?.toLowerCase() !== 'true') return;

  demoTask = cron.schedule('0 * * * *', () => {
    try {
      const { resetDemoUser } = require('./demo/demo-reset');
      resetDemoUser();
    } catch (err: unknown) {
      logError(`Demo reset: ${err instanceof Error ? err.message : err}`);
    }
  });
  logInfo('Demo hourly reset scheduled');
}

// Trip reminders: daily check at 9 AM local time for trips starting tomorrow
let reminderTask: ScheduledTask | null = null;

function startTripReminders(): void {
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }

  try {
    const { db } = require('./db/database');
    const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
    const reminderEnabled = getSetting('notify_trip_reminder') !== 'false';
    const channelsRaw = getSetting('notification_channels') || getSetting('notification_channel') || 'none';
    const activeChannels = channelsRaw === 'none' ? [] : channelsRaw.split(',').map((c: string) => c.trim());
    if (!reminderEnabled) {
      logInfo('Trip reminders: disabled in settings');
      return;
    }

    const tripCount = (db.prepare('SELECT COUNT(*) as c FROM trips WHERE reminder_days > 0 AND start_date IS NOT NULL').get() as { c: number }).c;
    logInfo(`Trip reminders: enabled via [${activeChannels.join(',')}]${tripCount > 0 ? `, ${tripCount} trip(s) with active reminders` : ''}`);
  } catch {
    return;
  }

  const tz = process.env.TZ || 'UTC';
  reminderTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { db } = require('./db/database');
      const { send } = require('./services/notificationService');

      const trips = db.prepare(`
        SELECT t.id, t.title, t.user_id, t.reminder_days FROM trips t
        WHERE t.reminder_days > 0
          AND t.start_date IS NOT NULL
          AND t.start_date = date('now', '+' || t.reminder_days || ' days')
      `).all() as { id: number; title: string; user_id: number; reminder_days: number }[];

      for (const trip of trips) {
        await send({ event: 'trip_reminder', actorId: null, scope: 'trip', targetId: trip.id, params: { trip: trip.title, tripId: String(trip.id) } }).catch(() => {});
      }

      if (trips.length > 0) {
        logInfo(`Trip reminders sent for ${trips.length} trip(s): ${trips.map(t => `"${t.title}" (${t.reminder_days}d)`).join(', ')}`);
      }
    } catch (err: unknown) {
      logError(`Trip reminder check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Todo due-date reminders: daily check at 9 AM for unchecked todos
// whose due_date falls within the next TODO_REMINDER_LEAD_DAYS days.
// Each todo gets reminded at most once per 24 h (tracked via
// todo_items.reminded_at) so the scheduler doesn't spam the user every
// morning leading up to the deadline.
const TODO_REMINDER_LEAD_DAYS = 3;
let todoReminderTask: ScheduledTask | null = null;

function startTodoReminders(): void {
  if (todoReminderTask) { todoReminderTask.stop(); todoReminderTask = null; }

  const { db } = require('./db/database');
  const getSetting = (key: string) => (db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as { value: string } | undefined)?.value;
  const enabled = getSetting('notify_todo_due') !== 'false';
  if (!enabled) {
    logInfo('Todo due reminders: disabled in settings');
    return;
  }
  logInfo(`Todo due reminders: enabled (lead ${TODO_REMINDER_LEAD_DAYS}d)`);

  const tz = process.env.TZ || 'UTC';
  todoReminderTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { send } = require('./services/notificationService');

      // Select unchecked todos with a due date inside the lead window
      // that haven't been reminded in the last 24 hours. `due_date` is
      // stored as a YYYY-MM-DD text; SQLite date() handles it directly.
      const todos = db.prepare(`
        SELECT ti.id, ti.trip_id, ti.name, ti.due_date, ti.assigned_user_id,
               t.title AS trip_title, t.user_id AS trip_owner_id
        FROM todo_items ti
        JOIN trips t ON t.id = ti.trip_id
        WHERE ti.checked = 0
          AND ti.due_date IS NOT NULL
          AND ti.due_date <> ''
          AND date(ti.due_date) <= date('now', '+' || ? || ' days')
          AND date(ti.due_date) >= date('now')
          AND (ti.reminded_at IS NULL OR ti.reminded_at <= datetime('now', '-20 hours'))
      `).all(TODO_REMINDER_LEAD_DAYS) as {
        id: number; trip_id: number; name: string; due_date: string;
        assigned_user_id: number | null; trip_title: string; trip_owner_id: number;
      }[];

      for (const todo of todos) {
        const targetScope: 'user' | 'trip' = todo.assigned_user_id ? 'user' : 'trip';
        const targetId = todo.assigned_user_id ?? todo.trip_id;
        await send({
          event: 'todo_due',
          actorId: null,
          scope: targetScope,
          targetId,
          params: {
            todo: todo.name,
            trip: todo.trip_title,
            tripId: String(todo.trip_id),
            due: todo.due_date,
          },
        }).catch(() => {});
        db.prepare('UPDATE todo_items SET reminded_at = CURRENT_TIMESTAMP WHERE id = ?').run(todo.id);
      }

      if (todos.length > 0) {
        logInfo(`Todo reminders sent for ${todos.length} item(s)`);
      }
    } catch (err: unknown) {
      logError(`Todo reminder check failed: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Version check: daily at 9 AM — notify admins if a new TREK release is available
let versionCheckTask: ScheduledTask | null = null;

function startVersionCheck(): void {
  if (versionCheckTask) { versionCheckTask.stop(); versionCheckTask = null; }

  const tz = process.env.TZ || 'UTC';
  versionCheckTask = cron.schedule('0 9 * * *', async () => {
    try {
      const { checkAndNotifyVersion } = require('./services/adminService');
      await checkAndNotifyVersion();
    } catch (err: unknown) {
      logError(`Version check: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Idempotency key cleanup: nightly at 3 AM — delete keys older than 24 hours
let idempotencyCleanupTask: ScheduledTask | null = null;

function startIdempotencyCleanup(): void {
  if (idempotencyCleanupTask) { idempotencyCleanupTask.stop(); idempotencyCleanupTask = null; }

  const tz = process.env.TZ || 'UTC';
  idempotencyCleanupTask = cron.schedule('0 3 * * *', () => {
    try {
      const { db } = require('./db/database');
      const cutoff = Math.floor(Date.now() / 1000) - 86400;
      const result = db.prepare('DELETE FROM idempotency_keys WHERE created_at < ?').run(cutoff);
      if (result.changes > 0) {
        logInfo(`Idempotency cleanup: removed ${result.changes} expired key(s)`);
      }
    } catch (err: unknown) {
      logError(`Idempotency cleanup: ${err instanceof Error ? err.message : err}`);
    }
  }, { timezone: tz });
}

// Trek photo cache cleanup: every 2 hours — evict disk files and DB rows past their 1h TTL
let trekPhotoCacheTask: ScheduledTask | null = null;

function startTrekPhotoCacheCleanup(): void {
  if (trekPhotoCacheTask) { trekPhotoCacheTask.stop(); trekPhotoCacheTask = null; }

  // Run once immediately on startup to evict any entries left over from a previous run
  try {
    const { sweepExpired } = require('./services/memories/trekPhotoCache');
    sweepExpired();
  } catch { /* cache dir may not exist yet — harmless */ }

  trekPhotoCacheTask = cron.schedule('0 */2 * * *', () => {
    try {
      const { sweepExpired } = require('./services/memories/trekPhotoCache');
      sweepExpired();
    } catch (err: unknown) {
      logError(`Trek photo cache cleanup: ${err instanceof Error ? err.message : err}`);
    }
  });
}

function stop(): void {
  if (currentTask) { currentTask.stop(); currentTask = null; }
  if (demoTask) { demoTask.stop(); demoTask = null; }
  if (reminderTask) { reminderTask.stop(); reminderTask = null; }
  if (versionCheckTask) { versionCheckTask.stop(); versionCheckTask = null; }
  if (idempotencyCleanupTask) { idempotencyCleanupTask.stop(); idempotencyCleanupTask = null; }
  if (trekPhotoCacheTask) { trekPhotoCacheTask.stop(); trekPhotoCacheTask = null; }
}

export { start, stop, startDemoReset, startTripReminders, startTodoReminders, startVersionCheck, startIdempotencyCleanup, startTrekPhotoCacheCleanup, loadSettings, saveSettings, VALID_INTERVALS };
