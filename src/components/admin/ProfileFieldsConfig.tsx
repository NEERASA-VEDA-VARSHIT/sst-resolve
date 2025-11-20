"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface ProfileField {
	id?: number;
	field_name: string;
	required: boolean;
	editable: boolean;
	display_order: number;
}

interface ProfileFieldsConfigProps {
	categoryId: number;
	categoryName: string;
}

// Available profile fields that can be collected
const AVAILABLE_FIELDS = [
	{ name: "rollNo", label: "Roll Number", description: "Student roll number (e.g., 24bcs10005)" },
	{ name: "name", label: "Full Name", description: "Student's full name" },
	{ name: "email", label: "Email", description: "Email address (auto-generated, typically not editable)" },
	{ name: "phone", label: "Phone Number", description: "Contact phone number" },
	{ name: "hostel", label: "Hostel", description: "Hostel name (Neeladri/Velankani)" },
	{ name: "roomNumber", label: "Room Number", description: "Room number in hostel" },
	{ name: "batchYear", label: "Batch Year", description: "Academic batch year (e.g., 2024)" },
	{ name: "classSection", label: "Class Section", description: "Class section (A, B, C, D)" },
];

export function ProfileFieldsConfig({ categoryId, categoryName }: ProfileFieldsConfigProps) {
	const [fields, setFields] = useState<ProfileField[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		fetchProfileFields();
	}, [categoryId]);

	const fetchProfileFields = async () => {
		try {
			setLoading(true);
			const response = await fetch(`/api/admin/categories/${categoryId}/profile-fields`);
			if (response.ok) {
				const data = await response.json();
				// Map existing fields to state
				const existingFields = data.profileFields || [];
				const fieldMap = new Map(
					existingFields.map((f: ProfileField) => [f.field_name, f])
				);

				// Initialize all available fields with defaults
				// If field doesn't exist in DB, it's disabled by default (required: false, editable: false)
				// Email and Roll Number are always read-only (editable: false)
				const initializedFields = AVAILABLE_FIELDS.map((field, index) => {
					const existing = fieldMap.get(field.name);
					const isReadOnly = field.name === "email" || field.name === "rollNo";
					
					if (existing) {
						// Field exists in DB - use saved values, but force read-only fields to editable: false
						return {
							field_name: field.name,
							required: existing.required,
							editable: isReadOnly ? false : existing.editable,
							display_order: existing.display_order,
						};
					} else {
						// Field doesn't exist in DB - disabled by default
						return {
							field_name: field.name,
							required: false,
							editable: false, // Always false for unconfigured fields, and always false for read-only fields
							display_order: index,
						};
					}
				});

				setFields(initializedFields);
			} else {
				toast.error("Failed to load profile field configuration");
			}
		} catch (error) {
			console.error("Error fetching profile fields:", error);
			toast.error("Failed to load profile field configuration");
		} finally {
			setLoading(false);
		}
	};

	const handleToggleRequired = (fieldName: string) => {
		setFields((prev) =>
			prev.map((f) =>
				f.field_name === fieldName ? { ...f, required: !f.required } : f
			)
		);
	};

	const handleToggleEditable = (fieldName: string) => {
		// Email and Roll Number are always read-only, don't allow toggling
		if (fieldName === "email" || fieldName === "rollNo") {
			return;
		}
		setFields((prev) =>
			prev.map((f) =>
				f.field_name === fieldName ? { ...f, editable: !f.editable } : f
			)
		);
	};

	const handleToggleEnabled = (fieldName: string) => {
		const field = fields.find((f) => f.field_name === fieldName);
		if (!field) return;

		const isReadOnly = fieldName === "email" || fieldName === "rollNo";

		// If field is enabled (required or editable), disable it
		// If disabled, enable it with default values
		// For read-only fields (email, rollNo), editable is always false
		if (field.required || field.editable) {
			setFields((prev) =>
				prev.map((f) =>
					f.field_name === fieldName
						? { ...f, required: false, editable: false }
						: f
				)
			);
		} else {
			setFields((prev) =>
				prev.map((f) =>
					f.field_name === fieldName
						? { ...f, required: true, editable: isReadOnly ? false : true }
						: f
				)
			);
		}
	};

	const handleSave = async () => {
		try {
			setSaving(true);
			// Only send fields that are enabled (required or editable)
			// Force email and rollNo to be editable: false (read-only)
			const enabledFields = fields
				.filter((f) => f.required || f.editable)
				.map((f, index) => ({
					field_name: f.field_name,
					required: f.required,
					editable: (f.field_name === "email" || f.field_name === "rollNo") ? false : f.editable,
					display_order: index,
				}));

			const response = await fetch(
				`/api/admin/categories/${categoryId}/profile-fields`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ fields: enabledFields }),
				}
			);

			if (response.ok) {
				toast.success("Profile field configuration saved successfully");
				await fetchProfileFields();
			} else {
				const error = await response.json();
				toast.error(error.error || "Failed to save configuration");
			}
		} catch (error) {
			console.error("Error saving profile fields:", error);
			toast.error("Failed to save configuration");
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<Card>
				<CardContent className="py-8">
					<div className="flex items-center justify-center">
						<Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<User className="w-5 h-5" />
					Profile Fields Configuration
				</CardTitle>
				<CardDescription>
					Configure which profile fields to collect when students create tickets in the{" "}
					<strong>{categoryName}</strong> category. Check the boxes to enable fields,
					and configure whether they are required and editable.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-3">
					{AVAILABLE_FIELDS.map((fieldDef) => {
						const field = fields.find((f) => f.field_name === fieldDef.name);
						if (!field) return null;

						const isEnabled = field.required || field.editable;

						return (
							<div
								key={fieldDef.name}
								className={`p-4 border rounded-lg space-y-3 ${
									isEnabled ? "border-primary/50 bg-primary/5" : "border-border"
								}`}
							>
								<div className="flex items-start justify-between">
									<div className="flex-1">
										<div className="flex items-center gap-2">
											<Checkbox
												id={`enable-${fieldDef.name}`}
												checked={isEnabled}
												onCheckedChange={() => handleToggleEnabled(fieldDef.name)}
											/>
											<Label
												htmlFor={`enable-${fieldDef.name}`}
												className="text-base font-semibold cursor-pointer"
											>
												{fieldDef.label}
											</Label>
											{field.required && (
												<Badge variant="destructive" className="text-xs">
													Required
												</Badge>
											)}
											{!field.editable && isEnabled && (
												<Badge variant="secondary" className="text-xs">
													Read-only
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground mt-1 ml-7">
											{fieldDef.description}
										</p>
									</div>
								</div>

								{isEnabled && (
									<div className="ml-7 space-y-2">
										<div className="flex items-center gap-4">
											<div className="flex items-center gap-2">
												<Checkbox
													id={`required-${fieldDef.name}`}
													checked={field.required}
													onCheckedChange={() =>
														handleToggleRequired(fieldDef.name)
													}
													disabled={!isEnabled}
												/>
												<Label
													htmlFor={`required-${fieldDef.name}`}
													className="text-sm cursor-pointer"
												>
													Required
												</Label>
											</div>
											<div className="flex items-center gap-2">
												<Checkbox
													id={`editable-${fieldDef.name}`}
													checked={fieldDef.name === "email" || fieldDef.name === "rollNo" ? false : field.editable}
													onCheckedChange={() =>
														handleToggleEditable(fieldDef.name)
													}
													disabled={!isEnabled || fieldDef.name === "email" || fieldDef.name === "rollNo"}
												/>
												<Label
													htmlFor={`editable-${fieldDef.name}`}
													className="text-sm cursor-pointer"
												>
													Editable
												</Label>
												{(fieldDef.name === "email" || fieldDef.name === "rollNo") && (
													<span className="text-xs text-muted-foreground">
														({fieldDef.name === "email" ? "Email" : "Roll Number"} is always read-only)
													</span>
												)}
											</div>
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>

				<div className="flex justify-end pt-4 border-t">
					<Button onClick={handleSave} disabled={saving}>
						{saving ? (
							<>
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Save className="w-4 h-4 mr-2" />
								Save Configuration
							</>
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

