import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/api/auth(.*)',
  '/api/slack(.*)', // Allow Slack webhooks without authentication
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/(auth)(.*)', // auth routes (e.g., /login)
  '/public(.*)', // Public dashboard - accessible to all, including admins
]);

const isAdminRoute = createRouteMatcher([
  '/admin(.*)',
  '/superadmin(.*)',
  '/dashboard/admin(.*)', // legacy
  '/dashboard/superadmin(.*)', // legacy
  '/api/admin(.*)',
]);

const isStudentRoute = createRouteMatcher([
  '/student(.*)',
  '/dashboard(.*)', // legacy index redirect handler
  '/api/tickets(.*)',
]);

const isCommitteeRoute = createRouteMatcher([
  '/committee(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect all other routes
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url));
  }

  // Get role from session claims (after Clerk session token customization)
  const role = sessionClaims?.metadata?.role;

  // Check admin routes - only admin and super_admin allowed
  if (isAdminRoute(req)) {
    if (role === 'admin' || role === 'super_admin') {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Check committee routes - only committee allowed
  if (isCommitteeRoute(req)) {
    if (role === 'committee') {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Student routes - everyone authenticated can access
  if (isStudentRoute(req)) {
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};