"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import { DomainsActions } from "./DomainsActions";

interface Domain {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface Scope {
  id: number;
  domain_id: number;
  name: string;
  description: string | null;
  student_field_key: string | null;
  is_active: boolean;
  created_at: string;
}

interface DomainsListProps {
  domains: Domain[];
  scopes: Scope[];
  selectedDomain: number | null;
  onDomainSelect: (domainId: number) => void;
  onEditDomain: (domain: Domain) => void;
  onDeleteDomain: (domain: Domain) => void;
  onEditScope: (scope: Scope) => void;
  onDeleteScope: (scope: Scope) => void;
  onAddDomain: () => void;
  onAddScope: () => void;
}

export function DomainsList({
  domains,
  scopes,
  selectedDomain,
  onDomainSelect,
  onEditDomain,
  onDeleteDomain,
  onEditScope,
  onDeleteScope,
  onAddDomain,
  onAddScope,
}: DomainsListProps) {
  const filteredScopes = selectedDomain
    ? scopes.filter(s => s.domain_id === selectedDomain)
    : [];

  const selectedDomainData = domains.find(d => d.id === selectedDomain);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* DOMAINS CARD */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Domains</CardTitle>
            <CardDescription>Click a domain to view its scopes</CardDescription>
          </div>
          <Button onClick={onAddDomain} size="sm">
            <Building2 className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {domains.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No domains found
                  </TableCell>
                </TableRow>
              ) : (
                domains.map((domain) => (
                  <TableRow
                    key={domain.id}
                    className={`cursor-pointer transition-colors ${
                      selectedDomain === domain.id
                        ? "bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => onDomainSelect(domain.id)}
                  >
                    <TableCell className={`font-medium ${selectedDomain === domain.id ? "font-semibold" : ""}`}>
                      {domain.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {domain.description || "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <DomainsActions
                        onEdit={(e?: React.MouseEvent) => {
                          e?.stopPropagation();
                          onEditDomain(domain);
                        }}
                        onDelete={(e?: React.MouseEvent) => {
                          e?.stopPropagation();
                          onDeleteDomain(domain);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SCOPES CARD */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Scopes</CardTitle>
            <CardDescription>
              {selectedDomain
                ? `${selectedDomainData?.name || ''} Scopes`
                : "← Select a domain to view its scopes"}
            </CardDescription>
          </div>
          <Button
            onClick={onAddScope}
            size="sm"
            disabled={!selectedDomain}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Add Scope
          </Button>
        </CardHeader>
        <CardContent>
          {!selectedDomain ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm">
                Click on a domain from the left to view and manage its scopes
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredScopes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No scopes found for this domain
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredScopes.map((scope) => (
                    <TableRow key={scope.id}>
                      <TableCell className="font-medium">{scope.name}</TableCell>
                      <TableCell>
                        {scope.student_field_key ? (
                          <Badge variant="secondary" className="text-xs">
                            Dynamic ({scope.student_field_key.replace("_id", "")})
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Fixed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {scope.description || "-"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <DomainsActions
                          onEdit={() => onEditScope(scope)}
                          onDelete={() => onDeleteScope(scope)}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
