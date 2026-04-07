import Database from 'better-sqlite3';
import crypto from 'crypto';

function isOidcOnlyConfigured(): boolean {
  if (process.env.OIDC_ONLY !== 'true') return false;
  return !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID);
}

function seedAdminAccount(db: Database.Database): void {
  try {
    const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
    if (userCount > 0) return;

    if (isOidcOnlyConfigured()) {
      console.log('');
      console.log('╔══════════════════════════════════════════════╗');
      console.log('║  TREK — OIDC-Only Mode                       ║');
      console.log('║  First SSO login will become admin.           ║');
      console.log('╚══════════════════════════════════════════════╝');
      console.log('');
      return;
    }

    const bcrypt = require('bcryptjs');

    const env_admin_email = process.env.ADMIN_EMAIL;
    const env_admin_pw = process.env.ADMIN_PASSWORD;

    let password;
    let email;
    if (env_admin_email && env_admin_pw) {
      password = env_admin_pw;
      email = env_admin_email;
    } else {
      password = crypto.randomBytes(12).toString('base64url');
      email = 'admin@trek.local';
    }

    const hash = bcrypt.hashSync(password, 12);
    const username = 'admin';

    db.prepare('INSERT INTO users (username, email, password_hash, role, must_change_password) VALUES (?, ?, ?, ?, 1)').run(username, email, hash, 'admin');

    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  TREK — First Run: Admin Account Created     ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  Email:    ${email.padEnd(33)}║`);
    console.log(`║  Password: ${password.padEnd(33)}║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  } catch (err: unknown) {
    console.error('[ERROR] Error seeding admin account:', err instanceof Error ? err.message : err);
  }
}

function seedCategories(db: Database.Database): void {
  try {
    const existingCats = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
    if (existingCats.count === 0) {
      const defaultCategories = [
        { name: 'Hotel', color: '#3b82f6', icon: '🏨' },
        { name: 'Restaurant', color: '#ef4444', icon: '🍽️' },
        { name: 'Attraction', color: '#8b5cf6', icon: '🏛️' },
        { name: 'Shopping', color: '#f59e0b', icon: '🛍️' },
        { name: 'Transport', color: '#6b7280', icon: '🚌' },
        { name: 'Activity', color: '#10b981', icon: '🎯' },
        { name: 'Bar/Cafe', color: '#f97316', icon: '☕' },
        { name: 'Beach', color: '#06b6d4', icon: '🏖️' },
        { name: 'Nature', color: '#84cc16', icon: '🌿' },
        { name: 'Other', color: '#6366f1', icon: '📍' },
      ];
      const insertCat = db.prepare('INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)');
      for (const cat of defaultCategories) insertCat.run(cat.name, cat.color, cat.icon);
      console.log('Default categories seeded');
    }
  } catch (err: unknown) {
    console.error('Error seeding categories:', err instanceof Error ? err.message : err);
  }
}

function seedAddons(db: Database.Database): void {
  try {
    const defaultAddons = [
      { id: 'packing', name: 'Lists', description: 'Packing lists and to-do tasks for your trips', type: 'trip', icon: 'ListChecks', enabled: 1, sort_order: 0 },
      { id: 'budget', name: 'Budget Planner', description: 'Track expenses and plan your travel budget', type: 'trip', icon: 'Wallet', enabled: 1, sort_order: 1 },
      { id: 'documents', name: 'Documents', description: 'Store and manage travel documents', type: 'trip', icon: 'FileText', enabled: 1, sort_order: 2 },
      { id: 'vacay', name: 'Vacay', description: 'Personal vacation day planner with calendar view', type: 'global', icon: 'CalendarDays', enabled: 1, sort_order: 10 },
      { id: 'atlas', name: 'Atlas', description: 'World map of your visited countries with travel stats', type: 'global', icon: 'Globe', enabled: 1, sort_order: 11 },
      { id: 'mcp', name: 'MCP', description: 'Model Context Protocol for AI assistant integration', type: 'integration', icon: 'Terminal', enabled: 0, sort_order: 12 },
      { id: 'collab', name: 'Collab', description: 'Notes, polls, and live chat for trip collaboration', type: 'trip', icon: 'Users', enabled: 1, sort_order: 6 },
    ];
    const insertAddon = db.prepare('INSERT OR IGNORE INTO addons (id, name, description, type, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const a of defaultAddons) insertAddon.run(a.id, a.name, a.description, a.type, a.icon, a.enabled, a.sort_order);

    const providerRows = [
      {
        id: 'immich',
        name: 'Immich',
        description: 'Immich photo provider',
        icon: 'Image',
        enabled: 0,
        sort_order: 0,
      },
      {
        id: 'synologyphotos',
        name: 'Synology Photos',
        description: 'Synology Photos integration with separate account settings',
        icon: 'Image',
        enabled: 0,
        sort_order: 1,
      },
    ];
    const insertProvider = db.prepare('INSERT OR IGNORE INTO photo_providers (id, name, description, icon, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    for (const p of providerRows) insertProvider.run(p.id, p.name, p.description, p.icon, p.enabled, p.sort_order);

    const providerFields = [
      { provider_id: 'immich', field_key: 'immich_url', label: 'providerUrl', input_type: 'url', placeholder: 'https://immich.example.com', required: 1, secret: 0, settings_key: 'immich_url', payload_key: 'immich_url', sort_order: 0 },
      { provider_id: 'immich', field_key: 'immich_api_key', label: 'providerApiKey', input_type: 'password', placeholder: 'API Key', required: 1, secret: 1, settings_key: null, payload_key: 'immich_api_key', sort_order: 1 },
      { provider_id: 'synologyphotos', field_key: 'synology_url', label: 'providerUrl', input_type: 'url', placeholder: 'https://synology.example.com', required: 1, secret: 0, settings_key: 'synology_url', payload_key: 'synology_url', sort_order: 0 },
      { provider_id: 'synologyphotos', field_key: 'synology_username', label: 'providerUsername', input_type: 'text', placeholder: 'Username', required: 1, secret: 0, settings_key: 'synology_username', payload_key: 'synology_username', sort_order: 1 },
      { provider_id: 'synologyphotos', field_key: 'synology_password', label: 'providerPassword', input_type: 'password', placeholder: 'Password', required: 1, secret: 1, settings_key: null, payload_key: 'synology_password', sort_order: 2 },
      { provider_id: 'synologyphotos', field_key: 'synology_otp', label: 'providerOTP', input_type: 'number', placeholder: 'OTP', required: 0, secret: 0, settings_key: null, payload_key: 'synology_otp', sort_order: 3 },
    ];
    const insertProviderField = db.prepare('INSERT OR IGNORE INTO photo_provider_fields (provider_id, field_key, label, input_type, placeholder, required, secret, settings_key, payload_key, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const f of providerFields) {
      insertProviderField.run(f.provider_id, f.field_key, f.label, f.input_type, f.placeholder, f.required, f.secret, f.settings_key, f.payload_key, f.sort_order);
    }
    console.log('Default addons seeded');
  } catch (err: unknown) {
    console.error('Error seeding addons:', err instanceof Error ? err.message : err);
  }
}

function runSeeds(db: Database.Database): void {
  seedAdminAccount(db);
  seedCategories(db);
  seedAddons(db);
}

export { runSeeds };
