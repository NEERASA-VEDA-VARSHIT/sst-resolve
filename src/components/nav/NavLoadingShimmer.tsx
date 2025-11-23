"use client";

/**
 * Navigation Loading Shimmer
 * Shows while UnifiedNav fetches user role
 */
export function NavLoadingShimmer() {
  return (
    <>
      {/* Desktop Shimmer */}
      <header className="hidden lg:block sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="w-full">
          <div className="flex h-16 items-center px-6">
            {/* Logo shimmer */}
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
              <div className="h-6 w-32 rounded bg-muted animate-pulse" />
            </div>

            {/* Nav items shimmer */}
            <div className="flex items-center gap-2 flex-1 ml-8">
              <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
              <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
              <div className="h-9 w-20 rounded-lg bg-muted animate-pulse" />
            </div>

            {/* Right side shimmer */}
            <div className="flex items-center gap-4 ml-auto">
              <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
              <div className="h-10 w-40 rounded-lg bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Top Bar Shimmer */}
      <header className="lg:hidden sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-5 w-24 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
            <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav Shimmer */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-around h-16 px-2">
          <div className="flex flex-col items-center gap-1">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-14 rounded bg-muted animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </nav>
    </>
  );
}

