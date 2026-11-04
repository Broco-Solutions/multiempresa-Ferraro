import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { bootstrapOwnerEnvSchema } from '../src/infrastructure/auth/config';
import { hashPassword } from '../src/infrastructure/auth/password';
const result = bootstrapOwnerEnvSchema.safeParse(process.env);
if (!result.success) { console.error('Configuración de alta incompleta o contraseña inválida (12–128 caracteres).'); process.exit(1); }
const config = result.data;
const pool = new Pool({ connectionString: config.AUTH_DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  const passwordHash = await hashPassword(config.BOOTSTRAP_OWNER_PASSWORD);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE "user" IN EXCLUSIVE MODE');
    const ownerIndex = await client.query(`SELECT 1 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_class tbl ON tbl.oid=i.indrelid JOIN pg_namespace ns ON ns.oid=tbl.relnamespace WHERE idx.relname='single_owner' AND tbl.relname='user' AND ns.nspname=current_schema() AND i.indisunique AND i.indisvalid AND pg_get_expr(i.indexprs,i.indrelid)='true'`);
    if (ownerIndex.rowCount !== 1) throw new Error('OWNER_INDEX_MISSING');
    const existing = await client.query('SELECT id FROM "user" LIMIT 1');
    if (existing.rowCount) throw new Error('ALREADY_INITIALIZED');
    const id = randomUUID();
    await client.query('INSERT INTO "user" (id, name, email, "emailVerified", active, "createdAt", "updatedAt") VALUES ($1,$2,$3,true,true,NOW(),NOW())', [id, config.BOOTSTRAP_OWNER_NAME, config.BOOTSTRAP_OWNER_EMAIL]);
    await client.query('INSERT INTO account (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt") VALUES ($1,$2::text,$3,$2::uuid,$4,NOW(),NOW())', [randomUUID(), id, 'credential', passwordHash]);
    await client.query('COMMIT');
    console.info('Propietario creado. Eliminar las variables temporales de bootstrap.');
  } catch { await client.query('ROLLBACK'); throw new Error('BOOTSTRAP_REFUSED'); }
  finally { client.release(); }
} catch { console.error('Alta rechazada: verificar almacenamiento y que no exista ya un propietario.'); process.exitCode = 1; }
finally { delete process.env.BOOTSTRAP_OWNER_EMAIL; delete process.env.BOOTSTRAP_OWNER_NAME; delete process.env.BOOTSTRAP_OWNER_PASSWORD; await pool.end(); }
