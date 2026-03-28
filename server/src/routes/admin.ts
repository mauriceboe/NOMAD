import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { db } from '../db/database';
import { authenticate, adminOnly } from '../middleware/auth';
import { AuthRequest, User, Addon } from '../types';

const router = express.Router();

router.use(authenticate, adminOnly);

router.get('/users', (req: Request, res: Response) => {
  const users = db.prepare(
    'SELECT id, username, email, role, created_at, updated_at, last_login FROM users ORDER BY created_at DESC'
  ).all() as Pick<User, 'id' | 'username' | 'email' | 'role' | 'created_at' | 'updated_at' | 'last_login'>[];
  let onlineUserIds = new Set<number>();
  try {
    const { getOnlineUserIds } = require('../websocket');
    onlineUserIds = getOnlineUserIds();
  } catch { /* */ }
  const usersWithStatus = users.map(u => ({ ...u, online: onlineUserIds.has(u.id) }));
  res.json({ users: usersWithStatus });
});

router.post('/users', (req: Request, res: Response) => {
  const { username, email, password, role } = req.body;

  if (!username?.trim() || !email?.trim() || !password?.trim()) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existingUsername) return res.status(409).json({ error: 'Username already taken' });

  const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
  if (existingEmail) return res.status(409).json({ error: 'Email already taken' });

  const passwordHash = bcrypt.hashSync(password.trim(), 12);

  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username.trim(), email.trim(), passwordHash, role || 'user');

  const user = db.prepare(
    'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ user });
});

router.put('/users/:id', (req: Request, res: Response) => {
  const { username, email, role, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as User | undefined;

  if (!user) return res.status(404).json({ error: 'User not found' });

  if (role && !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  if (username && username !== user.username) {
    const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.params.id);
    if (conflict) return res.status(409).json({ error: 'Username already taken' });
  }
  if (email && email !== user.email) {
    const conflict = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.params.id);
    if (conflict) return res.status(409).json({ error: 'Email already taken' });
  }

  const passwordHash = password ? bcrypt.hashSync(password, 12) : null;

  db.prepare(`
    UPDATE users SET
      username = COALESCE(?, username),
      email = COALESCE(?, email),
      role = COALESCE(?, role),
      password_hash = COALESCE(?, password_hash),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(username || null, email || null, role || null, passwordHash, req.params.id);

  const updated = db.prepare(
    'SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?'
  ).get(req.params.id);

  res.json({ user: updated });
});

router.delete('/users/:id', (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  if (parseInt(req.params.id as string) === authReq.user.id) {
    return res.status(400).json({ error: 'Cannot delete own account' });
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/stats', (_req: Request, res: Response) => {
  const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  const totalTrips = (db.prepare('SELECT COUNT(*) as count FROM trips').get() as { count: number }).count;
  const totalPlaces = (db.prepare('SELECT COUNT(*) as count FROM places').get() as { count: number }).count;
  const totalFiles = (db.prepare('SELECT COUNT(*) as count FROM trip_files').get() as { count: number }).count;

  res.json({ totalUsers, totalTrips, totalPlaces, totalFiles });
});

router.get('/oidc', (_req: Request, res: Response) => {
  const get = (key: string) => (db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined)?.value || '';
  const secret = get('oidc_client_secret');
  res.json({
    issuer: get('oidc_issuer'),
    client_id: get('oidc_client_id'),
    client_secret_set: !!secret,
    display_name: get('oidc_display_name'),
    oidc_only: get('oidc_only') === 'true',
  });
});

router.put('/oidc', (req: Request, res: Response) => {
  const { issuer, client_id, client_secret, display_name, oidc_only } = req.body;
  const set = (key: string, val: string) => db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)").run(key, val || '');
  set('oidc_issuer', issuer);
  set('oidc_client_id', client_id);
  if (client_secret !== undefined) set('oidc_client_secret', client_secret);
  set('oidc_display_name', display_name);
  set('oidc_only', oidc_only ? 'true' : 'false');
  res.json({ success: true });
});

router.post('/save-demo-baseline', (_req: Request, res: Response) => {
  if (process.env.DEMO_MODE !== 'true') {
    return res.status(404).json({ error: 'Not found' });
  }
  try {
    const { saveBaseline } = require('../demo/demo-reset');
    saveBaseline();
    res.json({ success: true, message: 'Demo baseline saved. Hourly resets will restore to this state.' });
  } catch (err: unknown) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save baseline' });
  }
});

const isDocker = (() => {
  try {
    return fs.existsSync('/.dockerenv') || (fs.existsSync('/proc/1/cgroup') && fs.readFileSync('/proc/1/cgroup', 'utf8').includes('docker'));
  } catch { return false }
})();

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0, nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

router.get('/version-check', async (_req: Request, res: Response) => {
  const { version: currentVersion } = require('../../package.json');
  try {
    const resp = await fetch(
      'https://api.github.com/repos/mauriceboe/NOMAD/releases/latest',
      { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'TREK-Server' } }
    );
    if (!resp.ok) return res.json({ current: currentVersion, latest: currentVersion, update_available: false });
    const data = await resp.json() as { tag_name?: string; html_url?: string };
    const latest = (data.tag_name || '').replace(/^v/, '');
    const update_available = latest && latest !== currentVersion && compareVersions(latest, currentVersion) > 0;
    res.json({ current: currentVersion, latest, update_available, release_url: data.html_url || '', is_docker: isDocker });
  } catch {
    res.json({ current: currentVersion, latest: currentVersion, update_available: false, is_docker: isDocker });
  }
});

router.post('/update', async (_req: Request, res: Response) => {
  const rootDir = path.resolve(__dirname, '../../..');
  const serverDir = path.resolve(__dirname, '../..');
  const clientDir = path.join(rootDir, 'client');
  const steps: { step: string; success?: boolean; output?: string; version?: string }[] = [];

  try {
    const pullOutput = execSync('git pull origin main', { cwd: rootDir, timeout: 60000, encoding: 'utf8' });
    steps.push({ step: 'git pull', success: true, output: pullOutput.trim() });

    execSync('npm install --production --ignore-scripts', { cwd: serverDir, timeout: 120000, encoding: 'utf8' });
    steps.push({ step: 'npm install (server)', success: true });

    if (process.env.NODE_ENV === 'production') {
      execSync('npm install --ignore-scripts', { cwd: clientDir, timeout: 120000, encoding: 'utf8' });
      execSync('npm run build', { cwd: clientDir, timeout: 120000, encoding: 'utf8' });
      steps.push({ step: 'npm install + build (client)', success: true });
    }

    delete require.cache[require.resolve('../../package.json')];
    const { version: newVersion } = require('../../package.json');
    steps.push({ step: 'version', version: newVersion });

    res.json({ success: true, steps, restarting: true });

    setTimeout(() => {
      console.log('[Update] Restarting after update...');
      process.exit(0);
    }, 1000);
  } catch (err: unknown) {
    console.error(err);
    steps.push({ step: 'error', success: false, output: 'Internal error' });
    res.status(500).json({ success: false, steps });
  }
});

router.get('/addons', (_req: Request, res: Response) => {
  const addons = db.prepare('SELECT * FROM addons ORDER BY sort_order, id').all() as Addon[];
  res.json({ addons: addons.map(a => ({ ...a, enabled: !!a.enabled, config: JSON.parse(a.config || '{}') })) });
});

router.put('/addons/:id', (req: Request, res: Response) => {
  const addon = db.prepare('SELECT * FROM addons WHERE id = ?').get(req.params.id);
  if (!addon) return res.status(404).json({ error: 'Addon not found' });
  const { enabled, config } = req.body;
  if (enabled !== undefined) db.prepare('UPDATE addons SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, req.params.id);
  if (config !== undefined) db.prepare('UPDATE addons SET config = ? WHERE id = ?').run(JSON.stringify(config), req.params.id);
  const updated = db.prepare('SELECT * FROM addons WHERE id = ?').get(req.params.id) as Addon;
  res.json({ addon: { ...updated, enabled: !!updated.enabled, config: JSON.parse(updated.config || '{}') } });
});

export default router;
