"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface StudentProfile {
	id: number;
	userNumber: string;
	fullName: string | null;
	email: string | null;
	roomNumber: string | null;
	mobile: string | null;
	hostel: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export default function ProfilePage() {
	const router = useRouter();
	const { user, isLoaded } = useUser();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [profile, setProfile] = useState<StudentProfile | null>(null);
	const [needsLink, setNeedsLink] = useState(false);
	const [formData, setFormData] = useState({
		userNumber: "",
		fullName: "",
		email: "",
		roomNumber: "",
		mobile: "",
		hostel: "",
	});

	useEffect(() => {
		if (isLoaded && user) {
			// Redirect committee members to committee profile page
			const role = (user.publicMetadata as any)?.role;
			if (role === "committee") {
				router.push("/committee/profile");
				return;
			}
			fetchProfile();
		}
	}, [isLoaded, user, router]);

	const fetchProfile = async () => {
		try {
			setLoading(true);
			const response = await fetch("/api/profile");
			
			if (response.status === 404) {
				const data = await response.json();
				if (data.needsLink) {
					setNeedsLink(true);
					if (data.userNumber) {
						setFormData(prev => ({ ...prev, userNumber: data.userNumber }));
					}
				}
			} else if (response.ok) {
				const data = await response.json();
				setProfile(data);
				setFormData({
					userNumber: data.userNumber || "",
					fullName: data.fullName || "",
					email: data.email || "",
					roomNumber: data.roomNumber || "",
					mobile: data.mobile || "",
					hostel: data.hostel || "",
				});
				setNeedsLink(false);
			}
		} catch (error) {
			console.error("Error fetching profile:", error);
		} finally {
			setLoading(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSaving(true);

		try {
			const response = await fetch("/api/profile", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			if (response.ok) {
				const updated = await response.json();
				setProfile(updated);
				setNeedsLink(false);
				router.refresh();
			} else {
				const error = await response.json();
				toast.error(error.error || "Failed to update profile");
			}
		} catch (error) {
			console.error("Error updating profile:", error);
			toast.error("Failed to update profile. Please try again.");
		} finally {
			setSaving(false);
		}
	};

	if (!isLoaded || loading) {
		return (
			<div className="flex h-screen">
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="w-8 h-8 animate-spin text-primary" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100vh-73px)]">
			<div className="flex-1 overflow-y-auto p-6">
				<div className="max-w-2xl mx-auto">
					<div className="flex items-center gap-3 mb-6">
						<User className="w-8 h-8 text-primary" />
						<div>
							<h1 className="text-3xl font-bold">Profile</h1>
							<p className="text-muted-foreground">
								Manage your student information
							</p>
						</div>
					</div>

					<Card>
						<CardHeader>
							<CardTitle>Student Information</CardTitle>
							<CardDescription>
								{needsLink 
									? "Link your user number to get started, or update your existing profile."
									: "Update your profile information. Changes will be saved automatically."}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-4">
								<div>
									<Label htmlFor="userNumber">User Number *</Label>
									<Input
										id="userNumber"
										value={formData.userNumber}
										onChange={(e) => setFormData({ ...formData, userNumber: e.target.value })}
										placeholder="e.g., 24bcs10005"
										required
										disabled={!needsLink && !!profile}
									/>
									{!needsLink && profile && (
										<p className="text-xs text-muted-foreground mt-1">
											User number cannot be changed after linking
										</p>
									)}
								</div>

								<div>
									<Label htmlFor="fullName">Full Name</Label>
									<Input
										id="fullName"
										value={formData.fullName}
										onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
										placeholder="Enter your full name"
									/>
								</div>

								<div>
									<Label htmlFor="email">Email</Label>
									<Input
										id="email"
										type="email"
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										placeholder="Enter your email address"
									/>
								</div>

								<div>
									<Label htmlFor="roomNumber">Room Number</Label>
									<Input
										id="roomNumber"
										value={formData.roomNumber}
										onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
										placeholder="e.g., 101"
									/>
								</div>

								<div>
									<Label htmlFor="mobile">Mobile Number</Label>
									<Input
										id="mobile"
										type="tel"
										value={formData.mobile}
										onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
										placeholder="Enter your mobile number"
									/>
								</div>

								<div>
									<Label htmlFor="hostel">Hostel</Label>
									<Select
										value={formData.hostel}
										onValueChange={(value) => setFormData({ ...formData, hostel: value })}
									>
										<SelectTrigger id="hostel" className="w-full">
											<SelectValue placeholder="Select hostel" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="Neeladri">Neeladri</SelectItem>
											<SelectItem value="Velankani">Velankani</SelectItem>
											<SelectItem value="NA">None / Day Scholar</SelectItem>
										</SelectContent>
									</Select>
								</div>

								{profile && (
									<div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
										{profile.createdAt && (
											<p>Created: {new Date(profile.createdAt).toLocaleString()}</p>
										)}
										{profile.updatedAt && (
											<p>Last updated: {new Date(profile.updatedAt).toLocaleString()}</p>
										)}
									</div>
								)}

								<div className="flex gap-3 pt-4">
									<Button type="submit" disabled={saving}>
										{saving ? (
											<>
												<Loader2 className="w-4 h-4 mr-2 animate-spin" />
												Saving...
											</>
										) : (
											<>
												<Save className="w-4 h-4 mr-2" />
												Save Changes
											</>
										)}
									</Button>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}

