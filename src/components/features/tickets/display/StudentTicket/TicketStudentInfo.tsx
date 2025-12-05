import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "lucide-react";
import type { ResolvedProfileField } from "@/types/ticket";

interface TicketStudentInfoProps {
  profileFields: ResolvedProfileField[];
}

export function TicketStudentInfo({ profileFields }: TicketStudentInfoProps) {
  if (profileFields.length === 0) return null;

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <User className="w-4 h-4 text-primary" />
          </div>
          Student Information
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {profileFields.map((field) => (
            <div key={field.field_name} className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                {field.label}
              </p>
              <p className="text-sm font-semibold break-words">{field.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
