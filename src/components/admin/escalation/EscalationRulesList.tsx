"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, AlertTriangle } from "lucide-react";

interface EscalationRule {
  id: number;
  domain_id: number;
  scope_id: number | null;
  level: number;
  user_id: string | null;
  tat_hours?: number | null;
  scope?: { id: number; name: string };
  user?: {
    id: string;
    full_name: string | null;
    email: string | null;
    external_id: string | null;
  };
  notify_channel: string;
  created_at: Date | string | null;
  updated_at: Date | string | null;
}

interface EscalationRulesListProps {
  rules: EscalationRule[];
  categoryName: string;
  loading: boolean;
  onCreateRule: () => void;
  onEditRule: (rule: EscalationRule) => void;
  onDeleteRule: (id: number) => void;
}

export function EscalationRulesList({
  rules,
  categoryName,
  loading,
  onCreateRule,
  onEditRule,
  onDeleteRule,
}: EscalationRulesListProps) {
  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Loading escalation rules...</div>
    );
  }

  if (rules.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            No escalation rules configured for {categoryName}
          </p>
          <Button onClick={onCreateRule} variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create First Rule
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <Card key={rule.id} className="border-l-4 border-l-orange-500">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="font-semibold">
                    Level {rule.level}
                  </Badge>
                  {rule.scope && (
                    <Badge variant="secondary">{rule.scope.name}</Badge>
                  )}
                  {!rule.scope && (
                    <Badge variant="outline" className="text-xs">
                      Global
                    </Badge>
                  )}
                  {rule.tat_hours && (
                    <Badge variant="outline" className="text-xs">
                      TAT: {rule.tat_hours}h
                    </Badge>
                  )}
                </div>
                {rule.user ? (
                  <div className="space-y-1">
                    <p className="font-medium">{rule.user.full_name || 'Unknown'}</p>
                    {rule.user.email && (
                      <p className="text-sm text-muted-foreground">{rule.user.email}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No staff assigned</p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {rule.notify_channel === "slack" ? "Slack" : "Email"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEditRule(rule)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => onDeleteRule(rule.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
