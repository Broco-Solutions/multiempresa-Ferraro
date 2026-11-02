import { Pool } from 'pg';
export const ownerEmail = 'owner@example.test';
export const ownerPassword = 'isolated-owner-password-2026';
export const testSecret = 'isolated-session-secret-32-characters-minimum';
export function testDatabaseUrl() {
  const value = process.env.AUTH_TEST_DATABASE_URL;
  if (!value) throw new Error('Set AUTH_TEST_DATABASE_URL to an isolated local PostgreSQL database ending in _test.');
  const url = new URL(value);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw new Error('Refusing non-local or non-test database.');
  return value;
}
export function testPool() { return new Pool({ connectionString: testDatabaseUrl(), max: 4, connectionTimeoutMillis: 5000 }); }
