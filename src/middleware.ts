import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getRoleFast } from '@/lib/auth/get-role-fast';

const isPublicRoute = createRouteMatcher([
  '/',
  '/favicon.ico',
  '/api/auth(.*)',
  '/api/slack(.*)', // Allow Slack webhooks without authentication
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to home
  if (!userId) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // Skip redirects for API routes - let them handle their own authorization
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // EDGE RUNTIME FIX: Database queries don't work reliably in Edge runtime
  // Solution: Let users access any authenticated route, pages will handle authorization
  // This prevents "Failed query" errors while maintaining security at page level

  // Try to fetch role with timeout (may fail in Edge runtime with some DB drivers)
  // Use a reasonable timeout to prevent middleware from hanging while allowing DB queries to complete
  let role: string | null = null;
  
  try {
    // Create a timeout promise that rejects after 2.5 seconds
    // Increased from 1.5s to allow more time for database queries in Edge runtime
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), 2500);
    });
    
    // Race between the role query and timeout
    role = await Promise.race([
      getRoleFast(userId),
      timeoutPromise
    ]);
  } catch (error) {
    // Check if it was a timeout
    if (error instanceof Error && error.message === 'TIMEOUT') {
      // Only log in development to reduce production log noise
      // Pages handle authorization anyway, so this is not a critical error
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Middleware] Role query timed out (>2.5s), allowing access - page will authorize');
      }
    } else {
      // Edge runtime database error - let page handle authorization
      // Only log in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('[Middleware] DB query failed (Edge runtime), allowing access - page will authorize');
      }
    }
    // On any error (timeout or DB error), allow access and let page handle authorization
    return NextResponse.next();
  }

  // If role not found (DB unavailable or user doesn't exist yet), allow access
  // Pages will handle role assignment and redirects
  // This prevents redirect loops when DB queries fail in Edge runtime
  if (!role) {
    // Allow all routes - let page layouts handle authorization
    // This prevents redirect loops when DB is unavailable
    return NextResponse.next();
  }

  const effectiveRole = role;

  const isSuperAdmin = effectiveRole === 'super_admin';
  // Note: SuperAdmin must NOT be included in isAdmin to avoid routing conflicts
  const isAdmin = !isSuperAdmin && (effectiveRole === 'admin');
  const isStudent = effectiveRole === 'student';
  const isCommittee = effectiveRole === 'committee';

  // Handle /dashboard redirects - route users to their role-specific dashboard
  if (pathname === '/dashboard') {
    if (isSuperAdmin) {
      return NextResponse.redirect(new URL('/superadmin/dashboard', req.url));
    }
    if (isAdmin) {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    if (isCommittee) {
      return NextResponse.redirect(new URL('/committee/dashboard', req.url));
    }
    if (isStudent) {
      return NextResponse.redirect(new URL('/student/dashboard', req.url));
    }
    // Fallback: unknown role, treat as student
    return NextResponse.redirect(new URL('/student/dashboard', req.url));
  }

  // SuperAdmin can access both /superadmin/* and /admin/* routes
  if (isSuperAdmin) {
    // Handle exact /admin path - redirect to superadmin dashboard
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/superadmin/dashboard', req.url));
    }
    // Allow all /superadmin/* and /admin/* routes including ticket detail pages
    // Check pathname directly to ensure ticket pages are allowed
    if (pathname.startsWith('/superadmin/') || pathname.startsWith('/admin/')) {
      return NextResponse.next();
    }
    // If not a superadmin or admin route, redirect to dashboard
    return NextResponse.redirect(new URL('/superadmin/dashboard', req.url));
  }

  // Admin role 
  if (isAdmin) {
    // Handle exact /admin path - redirect to admin dashboard
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    // Allow all /admin/* routes including ticket detail pages
    // Check pathname directly to ensure ticket pages are allowed
    if (pathname.startsWith('/admin/')) {
      return NextResponse.next();
    }
    // If not an admin route, redirect to dashboard
    return NextResponse.redirect(new URL('/admin/dashboard', req.url));
  }

  // Committee role
  if (isCommittee) {
    // Allow all /committee/* routes including ticket detail pages
    // Check pathname directly to ensure ticket pages are allowed
    if (pathname.startsWith('/committee/')) {
      return NextResponse.next();
    }
    // If not a committee route, redirect to dashboard
    return NextResponse.redirect(new URL('/committee/dashboard', req.url));
  }

  // Student role (default)
  if (isStudent) {
    // EDGE RUNTIME FIX: Skip profile check in middleware (fails in Edge runtime)
    // Student profile check moved to page layouts where DB queries work

    // Allow all /student/* routes including ticket detail pages
    // Check pathname directly to ensure ticket pages are allowed
    if (pathname.startsWith('/student/')) {
      return NextResponse.next();
    }
    // If not a student route, redirect to dashboard
    return NextResponse.redirect(new URL('/student/dashboard', req.url));
  }

  // Fallback: unknown role, treat as student
  return NextResponse.redirect(new URL('/student/dashboard', req.url));
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
