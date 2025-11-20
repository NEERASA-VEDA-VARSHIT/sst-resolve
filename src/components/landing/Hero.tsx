"use client";

import { Button } from "@/components/ui/button";
import { Ticket, ArrowRight } from "lucide-react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

export function Hero() {
  return (
    <div className="text-center space-y-4 md:space-y-6">
      <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 mb-4 md:mb-6">
        <Ticket className="w-8 h-8 md:w-10 md:h-10 text-primary" />
      </div>
      <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
        Welcome to SST Resolve
      </h1>
      <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
        Your comprehensive ticket management system for hostel and college issues. 
        Submit, track, and resolve tickets seamlessly.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center pt-4 md:pt-6">
        <SignUpButton mode="modal">
          <Button size="lg" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8">
            Get Started
            <ArrowRight className="ml-2 w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </SignUpButton>
        <SignInButton mode="modal">
          <Button variant="outline" size="lg" className="w-full sm:w-auto text-base md:text-lg px-6 md:px-8">
            Sign In
          </Button>
        </SignInButton>
      </div>
    </div>
  );
}

