import 'server-only';
import { Pool } from 'pg';
import { authDatabasePoolOptions, authEnvSchema, createAuth, isPersistedOwner } from './config';
let instance: ReturnType<typeof createAuth> | undefined;
let database: Pool | undefined;
export function getAuth() {
  if (!instance) {
    const result = authEnvSchema.safeParse(process.env);
    if (!result.success) throw new Error('AUTH_NOT_CONFIGURED');
    database = new Pool({ ...authDatabasePoolOptions(result.data), max: 3, connectionTimeoutMillis: 5000, query_timeout: 5000 });
    database.on('error', () => { /* Fail closed on the next operation; never log connection details. */ });
    instance = createAuth(database, result.data);
  }
  return instance;
}
export async function isOwnerAccount(userId: string) {
  getAuth(); // Validate configuration before touching the database pool.
  if (!database) return false;
  return isPersistedOwner(database, userId);
}
