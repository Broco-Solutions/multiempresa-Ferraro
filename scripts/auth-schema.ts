import { writeFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import { authEnvSchema, createAuth } from '../src/infrastructure/auth/config';
// Explicit operator command only. Never imported by the app or build.
const config = authEnvSchema.safeParse(process.env);
if (!config.success) { console.error('Configuración de autenticación incompleta.'); process.exit(1); }
const pool = new Pool({ connectionString: config.data.AUTH_DATABASE_URL, connectionTimeoutMillis: 5000 });
try {
  const auth = createAuth(pool, config.data);
  const plan = await getMigrations(auth.options);
  if (process.argv.includes('--apply')) {
    await plan.runMigrations();
    await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS single_owner ON "user" ((true))');
    console.info('Esquema de identidad preparado.');
  } else {
    await writeFile('docs/auth-schema.sql', (await plan.compileMigrations()) + '\nCREATE UNIQUE INDEX IF NOT EXISTS single_owner ON "user" ((true));\n');
    console.info('Plan SQL generado para revisión; sin aplicar cambios.');
  }
} catch { console.error('No fue posible preparar el esquema de identidad.'); process.exitCode = 1; }
finally { await pool.end(); }
