"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ValidationError {
	row: number;
	field: string;
	message: string;
	value?: unknown;
}

interface UploadResult {
	success: boolean;
	created: number;
	updated: number;
	skipped: number;
	errors: ValidationError[];
	summary: string;
}

export function StudentBulkUpload() {
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [result, setResult] = useState<UploadResult | null>(null);
	const [errors, setErrors] = useState<ValidationError[]>([]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFile(selectedFile);
			setResult(null);
			setErrors([]);
		}
	};

	const downloadTemplate = async () => {
		try {
			const response = await fetch("/api/superadmin/students/template");
			if (!response.ok) {
				throw new Error("Failed to download template");
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "student_upload_template.csv";
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);
		} catch (error) {
			console.error("Template download error:", error);
			alert("Failed to download template");
		}
	};

	const handleUpload = async () => {
		if (!file) return;

		setUploading(true);
		setResult(null);
		setErrors([]);

		try {
			const formData = new FormData();
			formData.append("file", file);

			const response = await fetch("/api/superadmin/students/bulk-upload", {
				method: "POST",
				body: formData,
			});

			// Check Content-Type before parsing JSON
			const contentType = response.headers.get("content-type");
			if (!contentType || !contentType.includes("application/json")) {
				throw new Error(`Server returned non-JSON response (${response.status} ${response.statusText})`);
			}

			const data = await response.json();

			if (response.ok) {
				setResult(data);
				if (data.success) {
					// Clear file input on success
					setFile(null);
					const input = document.getElementById("csv-upload") as HTMLInputElement;
					if (input) input.value = "";
				}
			} else {
				setErrors(data.errors || []);
			}
		} catch (error) {
			console.error("Upload error:", error);
			alert("Failed to upload file");
		} finally {
			setUploading(false);
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Bulk Upload Students</CardTitle>
					<CardDescription>
						Upload a CSV file to create or update multiple student profiles at once.
						All fields are mapped by email address (unique identifier).
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Download Template */}
					<div className="flex items-center justify-between p-4 border rounded-lg">
						<div>
							<p className="font-medium">1. Download CSV Template</p>
							<p className="text-sm text-muted-foreground">
								Get the template with correct headers and example data
							</p>
						</div>
						<Button onClick={downloadTemplate} variant="outline" size="sm">
							<Download className="w-4 h-4 mr-2" />
							Download Template
						</Button>
					</div>

					{/* File Upload */}
					<div className="flex items-center justify-between p-4 border rounded-lg">
						<div className="flex-1">
							<p className="font-medium mb-2">2. Upload Filled CSV</p>
							<input
								id="csv-upload"
								type="file"
								accept=".csv"
								onChange={handleFileChange}
								className="block w-full text-sm text-muted-foreground
									file:mr-4 file:py-2 file:px-4
									file:rounded-md file:border-0
									file:text-sm file:font-semibold
									file:bg-primary file:text-primary-foreground
									hover:file:bg-primary/90
									cursor-pointer"
							/>
							{file && (
								<p className="text-sm text-muted-foreground mt-2">
									Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
								</p>
							)}
						</div>
					</div>

					{/* Upload Button */}
					<div className="flex justify-end">
						<Button onClick={handleUpload} disabled={!file || uploading} size="lg">
							{uploading ? (
								<>
									<AlertCircle className="w-4 h-4 mr-2 animate-spin" />
									Uploading...
								</>
							) : (
								<>
									<Upload className="w-4 h-4 mr-2" />
									Upload & Process
								</>
							)}
						</Button>
					</div>

					{/* Upload Progress */}
					{uploading && (
						<div className="space-y-2">
							<Progress value={50} className="w-full" />
							<p className="text-sm text-muted-foreground text-center">
								Processing CSV file...
							</p>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Success Result */}
			{result && result.success && (
				<Alert className="border-green-500 bg-green-50 dark:bg-green-950">
					<CheckCircle2 className="h-4 w-4 text-green-600" />
					<AlertDescription className="ml-2">
						<div className="space-y-2">
							<p className="font-semibold text-green-900 dark:text-green-100">
								Upload Successful!
							</p>
							<div className="text-sm text-green-800 dark:text-green-200 space-y-1">
								<p>✓ Created: {result.created} new students</p>
								<p>✓ Updated: {result.updated} existing students</p>
								{result.skipped > 0 && <p>⚠ Skipped: {result.skipped} rows</p>}
							</div>
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* Validation Errors */}
			{errors.length > 0 && (
				<Alert variant="destructive">
					<XCircle className="h-4 w-4" />
					<AlertDescription className="ml-2">
						<div className="space-y-2">
							<p className="font-semibold">Validation Errors ({errors.length})</p>
							<div className="text-sm space-y-1 max-h-64 overflow-y-auto">
								{errors.slice(0, 20).map((error, index) => (
									<p key={index}>
										Row {error.row}, Field &quot;{error.field}&quot;: {error.message}
										{error.value !== undefined && error.value !== null && ` (Value: &quot;${String(error.value)}&quot;)`}
									</p>
								))}
								{errors.length > 20 && (
									<p className="font-semibold mt-2">
										... and {errors.length - 20} more errors
									</p>
								)}
							</div>
						</div>
					</AlertDescription>
				</Alert>
			)}

			{/* CSV Format Guidelines */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">CSV Format Guidelines</CardTitle>
				</CardHeader>
				<CardContent className="text-sm space-y-2">
					<div>
						<p className="font-medium">Required Fields:</p>
						<ul className="list-disc list-inside text-muted-foreground ml-2">
							<li>email - Must be unique and valid format</li>
							<li>full_name - Student&apos;s complete name</li>
							<li>user_number - Roll number (e.g., 24bcs10005)</li>
							<li>mobile - 10 digit phone number</li>
							<li>room_number - Room number</li>
							<li>hostel - Must match an active hostel name (case-insensitive)</li>
							<li>class_section - Must match an active class section (e.g., A, B, C, D)</li>
							<li>batch_year - Year (e.g., 2027) - Must match an active batch</li>
							<li>department - Department name</li>
						</ul>
					</div>
					<div className="pt-2 border-t">
						<p className="font-medium text-amber-600 dark:text-amber-400">
							⚠ Important Notes:
						</p>
						<ul className="list-disc list-inside text-muted-foreground ml-2">
							<li>Existing students will be updated based on email match</li>
							<li>New students will be created if email doesn&apos;t exist</li>
							<li>All data is validated before processing</li>
							<li>Students can only edit mobile number after creation</li>
						</ul>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
