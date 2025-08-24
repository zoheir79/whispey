import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Force Node.js runtime to avoid Edge Runtime module compatibility issues
export const runtime = 'nodejs';

// Define which routes are public (don't require authentication)
const publicPaths = [
  '/sign-in',
  '/sign-up',
  '/terms-of-service',
  '/privacy-policy',
  '/api/auth/login',
  '/api/auth/register',
];

// Function to check if the request path matches any of the public paths
function isPublicPath(path: string): boolean {
  return publicPaths.some(publicPath => 
    path === publicPath || path.startsWith(`${publicPath}/`)
  );
}

// Edge-compatible token validation (basic check only)
function isValidTokenFormat(token: string): boolean {
  try {
    // Basic JWT format check: xxx.yyy.zzz
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Skip API routes except those that need auth
  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/protected/')) {
    return NextResponse.next();
  }

  // Check for auth token in cookies
  const token = request.cookies.get('auth-token')?.value;

  // If no token found, redirect to sign-in
  if (!token) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Basic token format validation (Edge Runtime compatible)
  const validFormat = isValidTokenFormat(token);

  // If token is invalid, redirect to sign-in
  if (!validFormat) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Token is valid, add user ID to headers for use in API routes
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', userId || '');

  // Continue with the request
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};