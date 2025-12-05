import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import type { TATInfo } from "@/types/ticket";

interface TicketTATInfoProps {
  tatInfo: TATInfo;
}

export function TicketTATInfo({ tatInfo }: TicketTATInfoProps) {
  const hasTATInfo = tatInfo.tatSetAt || tatInfo.tatSetBy || tatInfo.tat;
  const hasExtensions = tatInfo.tatExtensions.length > 0;

  if (!hasTATInfo && !hasExtensions) return null;

  return (
    <>
      {hasTATInfo && (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              TAT Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tatInfo.tatSetAt && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">TAT Set At</p>
                  <p className="text-sm font-semibold break-words">
                    {format(new Date(tatInfo.tatSetAt), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              )}
              {tatInfo.tatSetBy && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">TAT Set By</p>
                  <p className="text-sm font-semibold break-words">
                    {tatInfo.tatSetBy}
                  </p>
                </div>
              )}
              {tatInfo.tat && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">TAT Duration</p>
                  <p className="text-sm font-semibold break-words">
                    {tatInfo.tat}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {hasExtensions && (
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              TAT Extensions ({tatInfo.tatExtensions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tatInfo.tatExtensions.map((extension, index) => {
                const extendedAt = extension.extendedAt ? String(extension.extendedAt) : null;
                const previousTAT = extension.previousTAT ? String(extension.previousTAT) : null;
                const newTAT = extension.newTAT ? String(extension.newTAT) : null;
                return (
                  <div key={index} className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Extension #{index + 1}</p>
                      {extendedAt && (
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(extendedAt), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {previousTAT && (
                        <div>
                          <span className="text-muted-foreground">Previous: </span>
                          <span className="font-medium">{previousTAT}</span>
                        </div>
                      )}
                      {newTAT && (
                        <div>
                          <span className="text-muted-foreground">New: </span>
                          <span className="font-medium">{newTAT}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
