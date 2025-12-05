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
import type { ClassSection } from "@/db/types-only";

interface SectionsTabProps {
	sections: ClassSection[];
	onAdd: () => void;
	onEdit: (section: ClassSection) => void;
	onDelete: (id: number) => void;
}

export function SectionsTab({ sections, onAdd, onEdit, onDelete }: SectionsTabProps) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Class Sections</CardTitle>
					<CardDescription>Manage class section information</CardDescription>
				</div>
				<Button onClick={onAdd}>
					<Plus className="h-4 w-4 mr-2" />
					Add Section
				</Button>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>ID</TableHead>
							<TableHead>Name</TableHead>
							<TableHead>Created At</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{sections.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="text-center text-muted-foreground">
									No sections found
								</TableCell>
							</TableRow>
						) : (
							sections.map((section) => (
								<TableRow key={section.id}>
									<TableCell>{section.id}</TableCell>
									<TableCell className="font-medium">{section.name}</TableCell>
									<TableCell>{new Date(section.created_at).toLocaleDateString()}</TableCell>
									<TableCell className="text-right space-x-2">
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onEdit(section)}
										>
											<Pencil className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() => onDelete(section.id)}
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
