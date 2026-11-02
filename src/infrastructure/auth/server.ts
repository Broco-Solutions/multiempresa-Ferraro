import 'server-only';
import { Pool } from 'pg';
import { authEnvSchema, createAuth } from './config';
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
  if (!instance) {
    const result = authEnvSchema.safeParse(process.env);
    if (!result.success) throw new Error('AUTH_NOT_CONFIGURED');
    const pool = new Pool({ connectionString: result.data.AUTH_DATABASE_URL, max: 3, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    pool.on('error', () => { /* Fail closed on the next operation; never log connection details. */ });
    instance = createAuth(pool, result.data);
  }
  return instance;
}
