import { getSessionCookie } from 'better-auth/cookies';
import { NextResponse, type NextRequest } from 'next/server';
export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  let response: NextResponse;
  if (path === '/login' || path.startsWith('/api/auth/')) response = NextResponse.next();
  else if (!getSessionCookie(request)) {
    response = path.startsWith('/api/')
      ? NextResponse.json({ message: 'No autorizado.' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', request.url));
  } else response = NextResponse.next();
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
