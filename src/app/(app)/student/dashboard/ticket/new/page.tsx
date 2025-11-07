"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { ArrowLeft, HelpCircle, CheckCircle2, AlertCircle, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface StudentProfile {
  userNumber: string;
  hostel: string | null;
}

export default function NewTicketPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [formData, setFormData] = useState({
    category: "",
    location: "",
    subcategory: "",
    description: "",
    details: {} as Record<string, any>,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadingImages, setUploadingImages] = useState<string[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  // Initialize uploaded images from formData when it changes
  useEffect(() => {
    if (formData.details?.images && Array.isArray(formData.details.images)) {
      setUploadedImages(formData.details.images);
    }
  }, [formData.details?.images]);

  // Calculate form completion progress and check if form is valid
  const { formProgress, isFormValid } = useMemo(() => {
    let completed = 0;
    let total = 3; // category, subcategory, description (base required fields)
    
    if (formData.category) completed++;
    if (formData.subcategory) completed++;
    if (formData.description?.trim()) completed++;
    
    // Check specific fields based on subcategory
    if (formData.subcategory === "Room Change Request") {
      total += 3; // roomFrom, roomTo, roomChangeReason
      if ((formData.details as any).roomFrom) completed++;
      if ((formData.details as any).roomTo) completed++;
      if ((formData.details as any).roomChangeReason) completed++;
    } else if (formData.subcategory === "Mess" || formData.subcategory === "Mess Quality Issues") {
      total += 2; // meal, date
      if ((formData.details as any).meal) completed++;
      if ((formData.details as any).date) completed++;
    } else if (formData.subcategory === "Maintenance / Housekeeping") {
      total += 1; // maintenanceType
      if ((formData.details as any).maintenanceType) completed++;
    }
    
    const progress = Math.round((completed / total) * 100);
    const valid = completed === total && total > 0;
    
    return { formProgress: progress, isFormValid: valid };
  }, [formData]);

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.category) {
      newErrors.category = "Category is required";
    }
    if (!formData.subcategory) {
      newErrors.subcategory = "Issue type is required";
    }
    if (!formData.description?.trim()) {
      newErrors.description = "Description is required";
    }
    
    if (formData.subcategory === "Room Change Request") {
      if (!(formData.details as any).roomFrom) {
        newErrors.roomFrom = "Current room is required";
      }
      if (!(formData.details as any).roomTo) {
        newErrors.roomTo = "Requested room is required";
      }
      if (!(formData.details as any).roomChangeReason) {
        newErrors.roomChangeReason = "Reason is required";
      }
    }
    
    if (formData.subcategory === "Mess" || formData.subcategory === "Mess Quality Issues") {
      if (!(formData.details as any).meal) {
        newErrors.meal = "Meal selection is required";
      }
      if (!(formData.details as any).date) {
        newErrors.date = "Date is required";
      }
    }
    
    if (formData.subcategory === "Maintenance / Housekeeping") {
      if (!(formData.details as any).maintenanceType) {
        newErrors.maintenanceType = "Maintenance type is required";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Fetch student profile on component mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const response = await fetch("/api/profile");
        
        if (response.ok) {
          const data = await response.json();
          setStudentProfile({
            userNumber: data.userNumber,
            hostel: data.hostel,
          });
        } else if (response.status === 404) {
          // Profile not linked - redirect to profile page
          router.push("/profile");
          return;
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const isHostel = formData.category === "Hostel";
  const isCollege = formData.category === "College";

  const issueTypes = useMemo(() => {
    if (isHostel) return [
      "Mess",
      "Maintenance / Housekeeping",
      "Wi-Fi",
      "Room Change Request",
      "Other",
    ];
    if (isCollege) return [
      "Mess",
      "Maintenance / Housekeeping",
      "Wi-Fi",
      "Other",
    ];
    return [];
  }, [isHostel, isCollege]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!studentProfile) {
      toast.error("Please complete your profile first");
      router.push("/profile");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      // Auto-fill userNumber and location (hostel) from student profile
      const ticketData = {
        ...formData,
        userNumber: studentProfile.userNumber,
        // If category is Hostel, use hostel from profile as location
        location: formData.category === "Hostel" && studentProfile.hostel 
          ? studentProfile.hostel 
          : formData.location,
        details: {
          ...formData.details,
        },
      };

      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ticketData),
      });

      if (response.ok) {
        const ticket = await response.json();
        toast.success("Ticket created successfully", {
          className: "bg-green-600 text-white border-green-500",
        });
        router.push(`/student/dashboard/ticket/${ticket.id}`);
        router.refresh();
      } else {
        const error = await response.json().catch(() => ({ error: "Failed to create ticket" }));
        toast.error(error.error || "Failed to create ticket");
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error("Failed to create ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const fileId = `${Date.now()}-${file.name}`;
    
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Only JPEG, PNG, and WebP images are allowed.");
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast.error("File size exceeds 10MB limit");
      return;
    }

    setUploadingImages((prev) => [...prev, fileId]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      setUploadedImages((prev) => [...prev, data.url]);
      
      // Update form details with image URLs
      setFormData((prev) => ({
        ...prev,
        details: {
          ...prev.details,
          images: [...(prev.details.images || []), data.url],
        },
      }));

      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setUploadingImages((prev) => prev.filter((id) => id !== fileId));
    }
  };

  // Remove uploaded image
  const handleRemoveImage = (imageUrl: string) => {
    setUploadedImages((prev) => prev.filter((url) => url !== imageUrl));
    setFormData((prev) => ({
      ...prev,
      details: {
        ...prev.details,
        images: (prev.details.images || []).filter((url: string) => url !== imageUrl),
      },
    }));
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/student/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Create New Ticket
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Fill in the details below to create a support ticket
              </CardDescription>
            </div>
          </div>
          
          {/* Progress Indicator */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Form Completion</span>
              <span className="font-medium">{formProgress}%</span>
            </div>
            <Progress value={formProgress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent>

            {profileLoading ? (
              <div className="space-y-4 py-8">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : !studentProfile ? (
              <Alert className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between">
                  <span>Please complete your profile first to create tickets</span>
                  <Link href="/profile">
                    <Button size="sm">Go to Profile</Button>
                  </Link>
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Display user info (read-only) */}
                <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-blue-900 dark:text-blue-100">
                          User: {studentProfile.userNumber}
                        </p>
                        {studentProfile.hostel && (
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            Hostel: {studentProfile.hostel}
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="category" className="text-base font-semibold">
                      Category <span className="text-destructive">*</span>
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Select whether this is a Hostel or College related issue</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      setFormData({
                        ...formData,
                        category: value,
                        location: "",
                        subcategory: "",
                        details: {},
                      });
                      setErrors({ ...errors, category: "" });
                    }}
                    required
                  >
                    <SelectTrigger 
                      id="category" 
                      className={`w-full h-11 ${errors.category ? "border-destructive" : ""}`}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hostel">Hostel</SelectItem>
                      <SelectItem value="College">College</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.category}
                    </p>
                  )}
                </div>


                {(isHostel || isCollege) && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="subcategory" className="text-base font-semibold">
                        Issue Type <span className="text-destructive">*</span>
                      </Label>
                    </div>
                    <Select
                      value={formData.subcategory}
                      onValueChange={(value) => {
                        setFormData({ ...formData, subcategory: value, details: {} });
                        setErrors({ ...errors, subcategory: "" });
                      }}
                      required
                    >
                      <SelectTrigger 
                        id="subcategory" 
                        className={`w-full h-11 ${errors.subcategory ? "border-destructive" : ""}`}
                      >
                        <SelectValue placeholder="Select issue type" />
                      </SelectTrigger>
                      <SelectContent>
                        {issueTypes.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.subcategory && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.subcategory}
                      </p>
                    )}
                  </div>
                )}

                {/* Leave Application removed */}

                {formData.subcategory === "Maintenance / Housekeeping" && isHostel && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="maintenanceType" className="text-base font-semibold">
                        Maintenance Type <span className="text-destructive">*</span>
                      </Label>
                    </div>
                    <Select
                      value={(formData.details as any).maintenanceType || ""}
                      onValueChange={(value) => {
                        setFormData({ ...formData, details: { ...formData.details, maintenanceType: value } });
                        setErrors({ ...errors, maintenanceType: "" });
                      }}
                      required
                    >
                      <SelectTrigger 
                        id="maintenanceType" 
                        className={`w-full h-11 ${errors.maintenanceType ? "border-destructive" : ""}`}
                      >
                        <SelectValue placeholder="Select maintenance type" />
                      </SelectTrigger>
                      <SelectContent>
                        {["Plumbing","Electrical","Painting","Carpenter","Pantry Area"].map((m) => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.maintenanceType && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.maintenanceType}
                      </p>
                    )}
                  </div>
                )}

                {formData.subcategory === "Room Change Request" && isHostel && (
                  <Card className="border-2 bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-lg">Room Change Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="roomFrom" className="text-base font-semibold">
                            From Room <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="roomFrom"
                            placeholder="Current room number"
                            required
                            value={(formData.details as any).roomFrom || ""}
                            onChange={(e) => {
                              setFormData({ ...formData, details: { ...formData.details, roomFrom: e.target.value } });
                              setErrors({ ...errors, roomFrom: "" });
                            }}
                            className={errors.roomFrom ? "border-destructive" : ""}
                          />
                          {errors.roomFrom && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.roomFrom}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="roomTo" className="text-base font-semibold">
                            To Room <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="roomTo"
                            placeholder="Requested room number"
                            required
                            value={(formData.details as any).roomTo || ""}
                            onChange={(e) => {
                              setFormData({ ...formData, details: { ...formData.details, roomTo: e.target.value } });
                              setErrors({ ...errors, roomTo: "" });
                            }}
                            className={errors.roomTo ? "border-destructive" : ""}
                          />
                          {errors.roomTo && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.roomTo}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="roomChangeReason" className="text-base font-semibold">
                          Room Transfer Reason <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                          id="roomChangeReason"
                          rows={4}
                          placeholder="Mention the reason for room transfer..."
                          required
                          value={(formData.details as any).roomChangeReason || ""}
                          onChange={(e) => {
                            setFormData({ ...formData, details: { ...formData.details, roomChangeReason: e.target.value } });
                            setErrors({ ...errors, roomChangeReason: "" });
                          }}
                          className={errors.roomChangeReason ? "border-destructive" : ""}
                        />
                        {errors.roomChangeReason && (
                          <p className="text-sm text-destructive flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.roomChangeReason}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {formData.subcategory === "Mess" && isCollege && (
                  <div className="space-y-2">
                    <Label htmlFor="vendors">Vendors</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) => setFormData({ ...formData, location: value })}
                      required
                    >
                      <SelectTrigger id="vendors" className="w-full">
                        <SelectValue placeholder="Select vendors" />
                      </SelectTrigger>
                      <SelectContent>
                        {["GSR", "Uniworld", "TCB"].map((loc) => (
                          <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {(formData.subcategory === "Mess" || formData.subcategory === "Mess Quality Issues") && (
                  <Card className="border-2 bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-lg">Meal Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="meal" className="text-base font-semibold">
                            Meal <span className="text-destructive">*</span>
                          </Label>
                          <Select
                            value={(formData.details as any).meal || ""}
                            onValueChange={(value) => {
                              setFormData({ ...formData, details: { ...formData.details, meal: value } });
                              setErrors({ ...errors, meal: "" });
                            }}
                            required
                          >
                            <SelectTrigger 
                              id="meal" 
                              className={`w-full h-11 ${errors.meal ? "border-destructive" : ""}`}
                            >
                              <SelectValue placeholder="Select meal" />
                            </SelectTrigger>
                            <SelectContent>
                              {["Breakfast","Lunch","Dinner"].map((m) => (
                                <SelectItem key={m} value={m}>{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.meal && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.meal}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date" className="text-base font-semibold">
                            Date <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="date"
                            type="date"
                            required
                            max={new Date().toISOString().split('T')[0]}
                            value={(formData.details as any).date || ""}
                            onChange={(e) => {
                              setFormData({ ...formData, details: { ...formData.details, date: e.target.value } });
                              setErrors({ ...errors, date: "" });
                            }}
                            className={errors.date ? "border-destructive" : ""}
                          />
                          {errors.date && (
                            <p className="text-sm text-destructive flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {errors.date}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Image Upload Section for Mess Issues */}
                      <div className="space-y-2 mt-4">
                        <Label className="text-base font-semibold flex items-center gap-2">
                          <ImageIcon className="w-4 h-4" />
                          Upload Images (Optional)
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Upload images of the mess quality issue (JPEG, PNG, WebP - Max 10MB each)
                        </p>
                        
                        <div className="flex flex-col gap-3">
                          {/* Image Upload Input */}
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/jpeg,image/jpg,image/png,image/webp"
                              onChange={handleImageUpload}
                              className="hidden"
                              id="image-upload"
                              disabled={uploadingImages.length > 0}
                            />
                            <Label
                              htmlFor="image-upload"
                              className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {uploadingImages.length > 0 ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Uploading...</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-4 h-4" />
                                  <span>Choose Image</span>
                                </>
                              )}
                            </Label>
                          </div>

                          {/* Uploaded Images Preview */}
                          {uploadedImages.length > 0 && (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {uploadedImages.map((imageUrl, index) => (
                                <div key={index} className="relative group">
                                  <div className="aspect-square rounded-lg overflow-hidden border-2 border-border">
                                    <img
                                      src={imageUrl}
                                      alt={`Upload ${index + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleRemoveImage(imageUrl)}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="description" className="text-base font-semibold">
                      Description <span className="text-destructive">*</span>
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Provide a detailed description of your issue</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Textarea
                    id="description"
                    rows={6}
                    value={formData.description}
                    onChange={(e) => {
                      setFormData({ ...formData, description: e.target.value });
                      setErrors({ ...errors, description: "" });
                    }}
                    placeholder="Enter a detailed description of your issue..."
                    className={errors.description ? "border-destructive" : ""}
                  />
                  <div className="flex items-center justify-between">
                    {errors.description && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground ml-auto">
                      {formData.description.length} characters
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end gap-3 pt-4">
                  <Link href="/student/dashboard">
                    <Button variant="outline" type="button" disabled={loading} size="lg">
                      Cancel
                    </Button>
                  </Link>
                  <Button 
                    type="submit" 
                    disabled={loading || !isFormValid}
                    size="lg"
                    className="min-w-[140px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Create Ticket
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
        </CardContent>
      </Card>
    </div>
  );
}


