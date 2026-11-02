import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../../src/infrastructure/auth/password';
import { ownerEmail, ownerPassword, testPool } from './auth';
export default async function setup() {
  const pool = testPool();
  try {
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await pool.query(await readFile(new URL('../../docs/auth-schema.sql', import.meta.url), 'utf8'));
    const id = randomUUID();
    await pool.query('INSERT INTO "user" (id,name,email,"emailVerified",active) VALUES ($1,$2,$3,true,true)', [id, 'Test Owner', ownerEmail]);
    await pool.query('INSERT INTO account (id,"accountId","providerId","userId",password,"updatedAt") VALUES ($1,$2::text,$3,$2::uuid,$4,NOW())', [randomUUID(), id, 'credential', await hashPassword(ownerPassword)]);
  } finally { await pool.end(); }
}
