"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users } from "lucide-react";

interface CommitteeDashboardTabsProps {
  taggedCount?: number;
}

export function CommitteeDashboardTabs({ taggedCount }: CommitteeDashboardTabsProps) {
  const pathname = usePathname();
  const isCreated = pathname?.includes("/created");
  const isTagged = pathname?.includes("/tagged");

  return (
    <Tabs value={isCreated ? "created" : isTagged ? "tagged" : "created"} className="w-full">
      <TabsList>
        <TabsTrigger value="created" asChild>
          <Link href="/committee/dashboard/created">My Created Tickets</Link>
        </TabsTrigger>
        <TabsTrigger value="tagged" asChild>
          <Link href="/committee/dashboard/tagged">
            <Users className="w-4 h-4 mr-2" />
            Tagged to My Committee{taggedCount !== undefined ? ` (${taggedCount})` : ""}
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
