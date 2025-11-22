"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddSingleStudentDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSuccess: () => void;
}

interface MasterData {
	hostels: Array<{ id: number; name: string }>;
	batches: Array<{ id: number; batch_year: number; display_name: string }>;
	sections: Array<{ id: number; name: string }>;
}

interface StudentFormData {
	email: string;
	full_name: string;
	user_number: string;
	hostel_id: string;
	room_number: string;
	class_section_id: string;
	batch_id: string;
	mobile: string;
	department: string;
}

interface FormErrors {
	email?: string;
	full_name?: string;
	user_number?: string;
	mobile?: string;
	room_number?: string;
}

export function AddSingleStudentDialog({
	open,
	onOpenChange,
	onSuccess,
}: AddSingleStudentDialogProps) {
	const [masterData, setMasterData] = useState<MasterData>({
		hostels: [],
		batches: [],
		sections: [],
	});
	const [loading, setLoading] = useState(false);
	const [fetching, setFetching] = useState(false);
	const [errors, setErrors] = useState<FormErrors>({});
	const [formData, setFormData] = useState<StudentFormData>({
		email: "",
		full_name: "",
		user_number: "",
		hostel_id: "",
		room_number: "",
		class_section_id: "",
		batch_id: "",
		mobile: "",
		department: "",
	});

	useEffect(() => {
		if (open) {
			fetchMasterData();
			// Reset form when dialog opens
			setFormData({
				email: "",
				full_name: "",
				user_number: "",
				hostel_id: "",
				room_number: "",
				class_section_id: "",
				batch_id: "",
				mobile: "",
				department: "",
			});
			setErrors({});
		}
	}, [open]);

	// Validation functions
	const validateEmail = (email: string): string | undefined => {
		if (!email.trim()) {
			return "Email is required";
		}
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email.trim())) {
			return "Please enter a valid email address";
		}
		return undefined;
	};

	const validateFullName = (name: string): string | undefined => {
		if (!name.trim()) {
			return "Full name is required";
		}
		if (name.trim().length < 2) {
			return "Full name must be at least 2 characters";
		}
		if (name.trim().length > 120) {
			return "Full name must not exceed 120 characters";
		}
		return undefined;
	};

	const validateRollNumber = (rollNo: string): string | undefined => {
		if (!rollNo.trim()) {
			return "Roll number is required";
		}
		if (rollNo.trim().length < 3) {
			return "Roll number must be at least 3 characters";
		}
		if (rollNo.trim().length > 32) {
			return "Roll number must not exceed 32 characters";
		}
		return undefined;
	};

	const validateMobile = (mobile: string): string | undefined => {
		if (!mobile.trim()) {
			return undefined; // Mobile is optional
		}
		const cleaned = mobile.replace(/\D/g, "");
		if (cleaned.length !== 10) {
			return "Mobile number must be 10 digits";
		}
		if (!/^[6-9]/.test(cleaned)) {
			return "Mobile number must start with 6, 7, 8, or 9";
		}
		return undefined;
	};

	const validateRoomNumber = (roomNo: string): string | undefined => {
		if (!roomNo.trim()) {
			return undefined; // Room number is optional
		}
		if (roomNo.trim().length > 16) {
			return "Room number must not exceed 16 characters";
		}
		return undefined;
	};

	const validateField = (fieldName: keyof FormErrors, value: string) => {
		let error: string | undefined;
		switch (fieldName) {
			case "email":
				error = validateEmail(value);
				break;
			case "full_name":
				error = validateFullName(value);
				break;
			case "user_number":
				error = validateRollNumber(value);
				break;
			case "mobile":
				error = validateMobile(value);
				break;
			case "room_number":
				error = validateRoomNumber(value);
				break;
		}
		setErrors((prev) => ({
			...prev,
			[fieldName]: error,
		}));
	};

	const validateAllFields = (): boolean => {
		const newErrors: FormErrors = {};
		
		const emailError = validateEmail(formData.email);
		if (emailError) newErrors.email = emailError;

		const nameError = validateFullName(formData.full_name);
		if (nameError) newErrors.full_name = nameError;

		const rollError = validateRollNumber(formData.user_number);
		if (rollError) newErrors.user_number = rollError;

		const mobileError = validateMobile(formData.mobile);
		if (mobileError) newErrors.mobile = mobileError;

		const roomError = validateRoomNumber(formData.room_number);
		if (roomError) newErrors.room_number = roomError;

		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	// Check if form is complete and valid
	const isFormValid = (): boolean => {
		// Check required fields are filled
		if (!formData.email.trim() || !formData.full_name.trim() || !formData.user_number.trim()) {
			return false;
		}

		// Check if there are any validation errors
		const emailError = validateEmail(formData.email);
		const nameError = validateFullName(formData.full_name);
		const rollError = validateRollNumber(formData.user_number);
		const mobileError = validateMobile(formData.mobile);
		const roomError = validateRoomNumber(formData.room_number);

		// Form is valid if no errors
		return !emailError && !nameError && !rollError && !mobileError && !roomError;
	};

	const fetchMasterData = async () => {
		setFetching(true);
		try {
			// Fetch hostels
			const hostelsRes = await fetch("/api/master/hostels");
			if (hostelsRes.ok) {
				const hostelsData = await hostelsRes.json();
				setMasterData((prev) => ({ ...prev, hostels: hostelsData.hostels || [] }));
			} else {
				console.error("Failed to fetch hostels:", hostelsRes.status, hostelsRes.statusText);
			}

			// Fetch batches
			const batchesRes = await fetch("/api/master/batches");
			if (batchesRes.ok) {
				const batchesData = await batchesRes.json();
				setMasterData((prev) => ({ ...prev, batches: batchesData.batches || [] }));
			} else {
				console.error("Failed to fetch batches:", batchesRes.status, batchesRes.statusText);
			}

			// Fetch sections
			const sectionsRes = await fetch("/api/master/class-sections");
			if (sectionsRes.ok) {
				const sectionsData = await sectionsRes.json();
				setMasterData((prev) => ({ ...prev, sections: sectionsData.sections || [] }));
			} else {
				console.error("Failed to fetch sections:", sectionsRes.status, sectionsRes.statusText);
			}
		} catch (error) {
			console.error("Error fetching master data:", error);
			toast.error("Failed to load form data. Please refresh and try again.");
		} finally {
			setFetching(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		// Validate all fields
		if (!validateAllFields()) {
			toast.error("Please fix the errors in the form");
			return;
		}

		setLoading(true);

		try {
			const response = await fetch("/api/superadmin/students/create", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: formData.email.trim().toLowerCase(),
					full_name: formData.full_name.trim(),
					user_number: formData.user_number.trim(),
					hostel_id: formData.hostel_id ? parseInt(formData.hostel_id) : null,
					room_number: formData.room_number.trim() || null,
					class_section_id: formData.class_section_id ? parseInt(formData.class_section_id) : null,
					batch_id: formData.batch_id ? parseInt(formData.batch_id) : null,
					mobile: formData.mobile ? formData.mobile.replace(/\D/g, "") : null,
					department: formData.department.trim() || null,
				}),
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || "Failed to create student");
			}

			toast.success("Student created successfully");
			onSuccess();
			onOpenChange(false);
		} catch (error) {
			console.error("Error creating student:", error);
			toast.error(error instanceof Error ? error.message : "Failed to create student");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Add New Student</DialogTitle>
					<DialogDescription>
						Fill in the student details below. Fields marked with * are required.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Required Fields */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="md:col-span-2">
							<Label htmlFor="email">
								Email <span className="text-red-500">*</span>
							</Label>
							<Input
								id="email"
								type="email"
								value={formData.email}
								onChange={(e) => {
									setFormData({ ...formData, email: e.target.value });
									if (errors.email) {
										validateField("email", e.target.value);
									}
								}}
								onBlur={(e) => validateField("email", e.target.value)}
								placeholder="student@example.com"
								className={errors.email ? "border-red-500" : ""}
								required
							/>
							{errors.email && (
								<p className="text-sm text-red-500 mt-1">{errors.email}</p>
							)}
						</div>

						<div className="md:col-span-2">
							<Label htmlFor="full_name">
								Full Name <span className="text-red-500">*</span>
							</Label>
							<Input
								id="full_name"
								value={formData.full_name}
								onChange={(e) => {
									setFormData({ ...formData, full_name: e.target.value });
									if (errors.full_name) {
										validateField("full_name", e.target.value);
									}
								}}
								onBlur={(e) => validateField("full_name", e.target.value)}
								placeholder="John Doe"
								className={errors.full_name ? "border-red-500" : ""}
								required
							/>
							{errors.full_name && (
								<p className="text-sm text-red-500 mt-1">{errors.full_name}</p>
							)}
						</div>

						<div>
							<Label htmlFor="user_number">
								Roll Number <span className="text-red-500">*</span>
							</Label>
							<Input
								id="user_number"
								value={formData.user_number}
								onChange={(e) => {
									setFormData({ ...formData, user_number: e.target.value });
									if (errors.user_number) {
										validateField("user_number", e.target.value);
									}
								}}
								onBlur={(e) => validateField("user_number", e.target.value)}
								placeholder="24bcs10005"
								className={errors.user_number ? "border-red-500" : ""}
								required
							/>
							{errors.user_number && (
								<p className="text-sm text-red-500 mt-1">{errors.user_number}</p>
							)}
						</div>

						<div>
							<Label htmlFor="mobile">Mobile Number</Label>
							<Input
								id="mobile"
								type="tel"
								value={formData.mobile}
								onChange={(e) => {
									// Only allow digits
									const value = e.target.value.replace(/\D/g, "").slice(0, 10);
									setFormData({ ...formData, mobile: value });
									if (errors.mobile) {
										validateField("mobile", value);
									}
								}}
								onBlur={(e) => validateField("mobile", e.target.value)}
								placeholder="9876543210"
								maxLength={10}
								className={errors.mobile ? "border-red-500" : ""}
							/>
							{errors.mobile && (
								<p className="text-sm text-red-500 mt-1">{errors.mobile}</p>
							)}
						</div>
					</div>

					{/* Optional Fields */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div>
							<Label htmlFor="hostel_id">Hostel</Label>
							<Select
								value={formData.hostel_id || undefined}
								onValueChange={(value) =>
									setFormData({ ...formData, hostel_id: value })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select hostel (optional)" />
								</SelectTrigger>
								<SelectContent>
									{masterData.hostels.map((hostel) => (
										<SelectItem key={hostel.id} value={hostel.id.toString()}>
											{hostel.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="room_number">Room Number</Label>
							<Input
								id="room_number"
								value={formData.room_number}
								onChange={(e) => {
									setFormData({ ...formData, room_number: e.target.value });
									if (errors.room_number) {
										validateField("room_number", e.target.value);
									}
								}}
								onBlur={(e) => validateField("room_number", e.target.value)}
								placeholder="205"
								className={errors.room_number ? "border-red-500" : ""}
							/>
							{errors.room_number && (
								<p className="text-sm text-red-500 mt-1">{errors.room_number}</p>
							)}
						</div>

						<div>
							<Label htmlFor="batch_id">Batch Year</Label>
							<Select
								value={formData.batch_id || undefined}
								onValueChange={(value) =>
									setFormData({ ...formData, batch_id: value })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select batch year (optional)" />
								</SelectTrigger>
								<SelectContent>
									{masterData.batches.map((batch) => (
										<SelectItem key={batch.id} value={batch.id.toString()}>
											{batch.display_name || batch.batch_year}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div>
							<Label htmlFor="class_section_id">Class Section</Label>
							<Select
								value={formData.class_section_id || undefined}
								onValueChange={(value) =>
									setFormData({ ...formData, class_section_id: value })
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select class section (optional)" />
								</SelectTrigger>
								<SelectContent>
									{masterData.sections.map((section) => (
										<SelectItem key={section.id} value={section.id.toString()}>
											{section.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="md:col-span-2">
							<Label htmlFor="department">Department</Label>
							<Input
								id="department"
								value={formData.department}
								onChange={(e) =>
									setFormData({ ...formData, department: e.target.value })
								}
								placeholder="Computer Science"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={loading}
						>
							Cancel
						</Button>
						<Button 
							type="submit" 
							disabled={loading || fetching || !isFormValid()}
							className="min-w-[120px]"
						>
							{loading ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Creating...
								</>
							) : fetching ? (
								<>
									<Loader2 className="w-4 h-4 mr-2 animate-spin" />
									Loading...
								</>
							) : (
								"Create Student"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

