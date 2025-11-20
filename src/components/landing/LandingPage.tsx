import { Hero } from "./Hero";
import { Features } from "./Features";

export function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] px-4 py-8 md:py-16 pb-24 lg:pb-8">
      <div className="w-full max-w-4xl space-y-8 md:space-y-12">
        <Hero />
        <Features />
        
        {/* Additional Info */}
        <div className="text-center space-y-2 pt-4 md:pt-8">
          <p className="text-sm md:text-base text-muted-foreground">
            Need help? Contact your admin or visit the help center.
          </p>
        </div>
      </div>
    </div>
  );
}

