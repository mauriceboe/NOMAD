/**
 * Unit tests for trimUserWhitespace — the backfill migration that normalises
 * leading/trailing whitespace in stored usernames and emails.
 * Tests TRIM-MIG-001 through TRIM-MIG-010.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { trimUserWhitespace } from '../../../src/db/migrations';

function makeDb() {
  const db = new Database(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT 'x',
      role TEXT NOT NULL DEFAULT 'user'
    )
  `);
  return db;
}

function insert(db: Database.Database, username: string, email: string): number {
  const r = db.prepare('INSERT INTO users (username, email) VALUES (?, ?)').run(username, email);
  return Number(r.lastInsertRowid);
}

function row(db: Database.Database, id: number) {
  return db.prepare('SELECT username, email FROM users WHERE id = ?').get(id) as { username: string; email: string };
}

describe('trimUserWhitespace — clean data (no-op)', () => {
  it('TRIM-MIG-001 — leaves already-clean rows untouched', () => {
    const db = makeDb();
    const id = insert(db, 'alice', 'alice@example.com');
    trimUserWhitespace(db);
    expect(row(db, id)).toEqual({ username: 'alice', email: 'alice@example.com' });
  });
});

describe('trimUserWhitespace — non-colliding dirty rows', () => {
  it('TRIM-MIG-002 — trims trailing whitespace from username', () => {
    const db = makeDb();
    const id = insert(db, 'alice   ', 'alice@example.com');
    trimUserWhitespace(db);
    expect(row(db, id).username).toBe('alice');
  });

  it('TRIM-MIG-003 — trims leading whitespace from username', () => {
    const db = makeDb();
    const id = insert(db, '   alice', 'alice@example.com');
    trimUserWhitespace(db);
    expect(row(db, id).username).toBe('alice');
  });

  it('TRIM-MIG-004 — trims surrounding whitespace from email', () => {
    const db = makeDb();
    const id = insert(db, 'alice', '  alice@example.com  ');
    trimUserWhitespace(db);
    expect(row(db, id).email).toBe('alice@example.com');
  });

  it('TRIM-MIG-005 — emits a console.warn for each trimmed row', () => {
    const db = makeDb();
    insert(db, 'bob   ', 'bob@example.com');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    trimUserWhitespace(db);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[migration] Trimmed username'));
    warn.mockRestore();
  });
});

describe('trimUserWhitespace — username collision handling', () => {
  it('TRIM-MIG-006 — renames the dirty row to <trimmed>__migrated_<id> on collision', () => {
    const db = makeDb();
    insert(db, 'carol', 'carol@example.com');
    const dirtyId = insert(db, 'carol   ', 'carol2@example.com');
    trimUserWhitespace(db);
    expect(row(db, dirtyId).username).toBe(`carol__migrated_${dirtyId}`);
  });

  it('TRIM-MIG-007 — emits a WHITESPACE COLLISION warning for username collision', () => {
    const db = makeDb();
    insert(db, 'dan', 'dan@example.com');
    insert(db, 'dan   ', 'dan2@example.com');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    trimUserWhitespace(db);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WHITESPACE COLLISION username'));
    warn.mockRestore();
  });

  it('TRIM-MIG-008 — the renamed value does not conflict with the existing clean row', () => {
    const db = makeDb();
    const cleanId = insert(db, 'eve', 'eve@example.com');
    const dirtyId = insert(db, 'eve   ', 'eve2@example.com');
    trimUserWhitespace(db);
    expect(row(db, cleanId).username).toBe('eve');
    expect(row(db, dirtyId).username).toBe(`eve__migrated_${dirtyId}`);
  });
});

describe('trimUserWhitespace — email collision handling', () => {
  it('TRIM-MIG-009 — renames dirty email as <local>__migrated_<id>@<domain> on collision', () => {
    const db = makeDb();
    insert(db, 'frank', 'frank@example.com');
    const dirtyId = insert(db, 'frank2', '  frank@example.com  ');
    trimUserWhitespace(db);
    expect(row(db, dirtyId).email).toBe(`frank__migrated_${dirtyId}@example.com`);
  });

  it('TRIM-MIG-010 — emits a WHITESPACE COLLISION warning for email collision', () => {
    const db = makeDb();
    insert(db, 'grace', 'grace@example.com');
    insert(db, 'grace2', 'grace@example.com   ');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    trimUserWhitespace(db);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WHITESPACE COLLISION email'));
    warn.mockRestore();
  });
});
