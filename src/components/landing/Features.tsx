import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Ticket, CheckCircle2, Zap } from "lucide-react";

export function Features() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-12">
      <Card className="border-2 hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Ticket className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-lg md:text-xl">Easy Ticket Creation</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm md:text-base">
            Submit tickets quickly with our intuitive form. Categorize by Hostel or College issues.
          </CardDescription>
        </CardContent>
      </Card>

      <Card className="border-2 hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg md:text-xl">Track Progress</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm md:text-base">
            Monitor your ticket status in real-time. Get updates on acknowledgments, progress, and resolutions.
          </CardDescription>
        </CardContent>
      </Card>

      <Card className="border-2 hover:shadow-lg transition-all duration-300 md:col-span-2 lg:col-span-1">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Zap className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-lg md:text-xl">Fast Resolution</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-sm md:text-base">
            Automated routing to the right admin. Escalation system ensures timely responses.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}

