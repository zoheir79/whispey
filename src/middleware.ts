import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Skip all API routes - they handle their own auth validation
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Check for auth token in cookies (simple presence check only)
  const token = request.cookies.get('auth-token')?.value;

  // If no token found, redirect to sign-in (token validation done in API routes)
  if (!token || token.length === 0) {
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