import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getRoleFast } from '@/lib/get-role-fast';

const isPublicRoute = createRouteMatcher([
  '/',
  '/favicon.ico',
  '/api/auth(.*)',
  '/api/slack(.*)', // Allow Slack webhooks without authentication
]);

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/api/admin(.*)',
]);

const isSuperAdminRoute = createRouteMatcher([
  '/superadmin(.*)',
]);

const isStudentRoute = createRouteMatcher([
  '/student(.*)',
  // NOTE: Do NOT include /api/tickets here. API routes handle auth internally.
  // /api/tickets is accessible by students, admins, committees, and superadmins
  // based on endpoint-level authorization checks.
]);

const isCommitteeRoute = createRouteMatcher([
  '/committee(.*)',
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
  
  // Try to fetch role (may fail in Edge runtime with some DB drivers)
  let role: string | null = null;
  try {
    role = await getRoleFast(userId);
  } catch (error) {
    // Edge runtime database error - let page handle authorization
    console.warn('[Middleware] DB query failed (Edge runtime), allowing access - page will authorize');
    return NextResponse.next();
  }
  
  // If role not found, allow access - page will handle user creation & authorization
  if (!role) {
    return NextResponse.next();
  }

  const effectiveRole = role;

  const isSuperAdmin = effectiveRole === 'super_admin';
  // Note: SuperAdmin must NOT be included in isAdmin to avoid routing conflicts
  const isAdmin = !isSuperAdmin && (effectiveRole === 'admin');
  const isStudent = effectiveRole === 'student';
  const isCommittee = effectiveRole === 'committee';

  // SuperAdmin can access both /superadmin/* and /admin/* routes
  if (isSuperAdmin) {
    if (!isSuperAdminRoute(req) && !isAdminRoute(req)) {
      return NextResponse.redirect(new URL('/superadmin/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Admin role 
  if (isAdmin) {
    if (!isAdminRoute(req)) {
      return NextResponse.redirect(new URL('/admin/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Committee role
  if (isCommittee) {
    if (!isCommitteeRoute(req)) {
      return NextResponse.redirect(new URL('/committee/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Student role (default)
  if (isStudent) {
    // EDGE RUNTIME FIX: Skip profile check in middleware (fails in Edge runtime)
    // Student profile check moved to page layouts where DB queries work
    
    // Student can access all student routes
    if (!isStudentRoute(req)) {
      return NextResponse.redirect(new URL('/student/dashboard', req.url));
    }
    return NextResponse.next();
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
