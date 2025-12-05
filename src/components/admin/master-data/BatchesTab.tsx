"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Batch } from "@/db/types-only";

interface BatchesTabProps {
	batches: Batch[];
	onAdd: () => void;
	onEdit: (batch: Batch) => void;
	onDelete: (id: number) => void;
}

export function BatchesTab({ batches, onAdd, onEdit, onDelete }: BatchesTabProps) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Batches</CardTitle>
					<CardDescription>Manage batch year information</CardDescription>
				</div>
				<Button onClick={onAdd}>
					<Plus className="h-4 w-4 mr-2" />
					Add Batch
				</Button>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ID</TableHead>
							<TableHead>Batch Year</TableHead>
							<TableHead>Created At</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{batches.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-center text-muted-foreground">
									No batches found
								</TableCell>
							</TableRow>
						) : (
							batches.sort((a, b) => b.batch_year - a.batch_year).map((batch) => (
								<TableRow key={batch.id}>
									<TableCell>{batch.id}</TableCell>
									<TableCell className="font-medium">
										{batch.batch_year}
										{batch.is_active === false && (
											<span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
										)}
									</TableCell>
									<TableCell>{new Date(batch.created_at).toLocaleDateString()}</TableCell>
									<TableCell className="text-right space-x-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onEdit(batch)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onDelete(batch.id)}
										>
											<Trash2 className="h-4 w-4 text-destructive" />
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
