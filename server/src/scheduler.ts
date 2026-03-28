import cron, { type ScheduledTask } from 'node-cron';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '../data');
const backupsDir = path.join(dataDir, 'backups');
const uploadsDir = path.join(__dirname, '../uploads');
const settingsFile = path.join(dataDir, 'backup-settings.json');

const CRON_EXPRESSIONS: Record<string, string> = {
  hourly:  '0 * * * *',
  daily:   '0 2 * * *',
  weekly:  '0 2 * * 0',
  monthly: '0 2 1 * *',
};

const VALID_INTERVALS = Object.keys(CRON_EXPRESSIONS);

interface BackupSettings {
  enabled: boolean;
  interval: string;
  keep_days: number;
}

let currentTask: ScheduledTask | null = null;

function loadSettings(): BackupSettings {
  try {
    if (fs.existsSync(settingsFile)) {
      return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
  } catch (e) {}
  return { enabled: false, interval: 'daily', keep_days: 7 };
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
    console.log(`[Auto-Backup] Created: ${filename}`);
  } catch (err: unknown) {
    console.error('[Auto-Backup] Error:', err instanceof Error ? err.message : err);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    return;
  }

  const settings = loadSettings();
  if (settings.keep_days > 0) {
    cleanupOldBackups(settings.keep_days);
  }
}

function cleanupOldBackups(keepDays: number): void {
  try {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - keepDays * MS_PER_DAY;
    const files = fs.readdirSync(backupsDir).filter(f => f.endsWith('.zip'));
    for (const file of files) {
      const filePath = path.join(backupsDir, file);
      const stat = fs.statSync(filePath);
      if (stat.birthtimeMs < cutoff) {
        fs.unlinkSync(filePath);
        console.log(`[Auto-Backup] Old backup deleted: ${file}`);
      }
    }
  } catch (err: unknown) {
    console.error('[Auto-Backup] Cleanup error:', err instanceof Error ? err.message : err);
  }
}

function start(): void {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  const settings = loadSettings();
  if (!settings.enabled) {
    console.log('[Auto-Backup] Disabled');
    return;
  }

  const expression = CRON_EXPRESSIONS[settings.interval] || CRON_EXPRESSIONS.daily;
  currentTask = cron.schedule(expression, runBackup);
  console.log(`[Auto-Backup] Scheduled: ${settings.interval} (${expression}), retention: ${settings.keep_days === 0 ? 'forever' : settings.keep_days + ' days'}`);
}

// Demo mode: hourly reset of demo user data
let demoTask: ScheduledTask | null = null;

function startDemoReset(): void {
  if (demoTask) { demoTask.stop(); demoTask = null; }
  if (process.env.DEMO_MODE !== 'true') return;

  demoTask = cron.schedule('0 * * * *', () => {
    try {
      const { resetDemoUser } = require('./demo/demo-reset');
      resetDemoUser();
    } catch (err: unknown) {
      console.error('[Demo Reset] Error:', err instanceof Error ? err.message : err);
    }
  });
  console.log('[Demo] Hourly reset scheduled (at :00 every hour)');
}

function stop(): void {
  if (currentTask) { currentTask.stop(); currentTask = null; }
  if (demoTask) { demoTask.stop(); demoTask = null; }
}

export { start, stop, startDemoReset, loadSettings, saveSettings, VALID_INTERVALS };
