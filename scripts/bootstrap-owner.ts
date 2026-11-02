import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { authEnvSchema } from '../src/infrastructure/auth/config';
import { hashPassword } from '../src/infrastructure/auth/password';
const result = authEnvSchema.extend({ BOOTSTRAP_OWNER_NAME: z.string().trim().min(2), BOOTSTRAP_OWNER_PASSWORD: z.string().min(12).max(128) }).safeParse(process.env);
if (!result.success) { console.error('Configuración de alta incompleta o contraseña inválida (12–128 caracteres).'); process.exit(1); }
const config = result.data;
const pool = new Pool({ connectionString: config.AUTH_DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  const passwordHash = await hashPassword(config.BOOTSTRAP_OWNER_PASSWORD);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE "user" IN EXCLUSIVE MODE');
    const existing = await client.query('SELECT id FROM "user" LIMIT 1');
    if (existing.rowCount) throw new Error('ALREADY_INITIALIZED');
    const id = randomUUID();
    await client.query('INSERT INTO "user" (id, name, email, "emailVerified", active, "createdAt", "updatedAt") VALUES ($1,$2,$3,true,true,NOW(),NOW())', [id, config.BOOTSTRAP_OWNER_NAME, config.AUTH_OWNER_EMAIL]);
    await client.query('INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2::text,$3,$2::uuid,$4,NOW(),NOW())', [randomUUID(), id, 'credential', passwordHash]);
    await client.query('COMMIT');
    console.info('Propietario creado. Eliminar las variables temporales de bootstrap.');
  } catch { await client.query('ROLLBACK'); throw new Error('BOOTSTRAP_REFUSED'); }
  finally { client.release(); }
} catch { console.error('Alta rechazada: verificar almacenamiento y que no exista ya un propietario.'); process.exitCode = 1; }
finally { delete process.env.BOOTSTRAP_OWNER_PASSWORD; await pool.end(); }
