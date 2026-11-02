import { getAuth } from '@/infrastructure/auth/server';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  const path = new URL(request.url).pathname;
  const allowed = request.method === 'POST'
    ? ['/api/auth/sign-in/email', '/api/auth/sign-out']
    : ['/api/auth/get-session'];
  if (!allowed.includes(path)) return Response.json({ message: 'No disponible.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  try {
    const response = await getAuth().handler(request);
    response.headers.set('Cache-Control', 'private, no-store');
    if (path === '/api/auth/get-session' && response.ok) {
      const current = await response.clone().json();
      if (current && (!current.user?.active || current.user.email !== process.env.AUTH_OWNER_EMAIL?.toLowerCase())) {
        return Response.json(null, { headers: { 'Cache-Control': 'private, no-store' } });
      }
    }
    // Never relay internal library/storage diagnostics or account-specific errors.
    if (response.status >= 400) return Response.json({ message: response.status === 429 ? 'Demasiados intentos. Esperá un minuto.' : 'No fue posible completar el acceso.' }, { status: response.status, headers: { 'Cache-Control': 'no-store', ...(response.headers.get('x-retry-after') ? { 'Retry-After': response.headers.get('x-retry-after')! } : {}) } });
    return response;
  } catch {
    return Response.json({ message: 'Acceso temporalmente no disponible.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
export const GET = handle;
export const POST = handle;
