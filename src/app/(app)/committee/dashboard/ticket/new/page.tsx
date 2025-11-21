"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import Link from "next/link";
import { ArrowLeft, HelpCircle, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { COMMITTEE_SUBCATEGORIES } from "@/lib/categories-constants";

export default function CommitteeNewTicketPage() {
  const router = useRouter();
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: "Committee",
    subcategory: "",
    description: "",
    details: {} as Record<string, unknown>,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate form completion progress and check if form is valid
  const { formProgress, isFormValid } = useMemo(() => {
    let completed = 0;
    const total = 2; // subcategory, description
    
    if (formData.subcategory) completed++;
    if (formData.description?.trim()) completed++;
    
    const progress = Math.round((completed / total) * 100);
    const valid = completed === total && total > 0;
    
    return { formProgress: progress, isFormValid: valid };
  }, [formData]);

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.subcategory) {
      newErrors.subcategory = "Subcategory is required";
    }
    if (!formData.description?.trim()) {
      newErrors.description = "Description is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    try {
      const ticketData = {
        ...formData,
        category: "Committee",
        userNumber: userId || "", // Use userId as userNumber for committee
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
        router.push(`/committee/dashboard/ticket/${ticket.id}`);
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

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/committee/dashboard">
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
                Create New Committee Ticket
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                Fill in the details below to create a committee ticket
              </CardDescription>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Form Completion</span>
              <span className="font-semibold">{formProgress}%</span>
            </div>
            <Progress value={formProgress} className="h-2" />
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Committee tickets are directly assigned to Super Admin for review.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="subcategory" className="text-base font-semibold">
                  Committee Type <span className="text-destructive">*</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Select the committee type for this ticket</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
                  <SelectValue placeholder="Select committee type" />
                </SelectTrigger>
                <SelectContent>
                  {COMMITTEE_SUBCATEGORIES.map((subcat) => (
                    <SelectItem key={subcat} value={subcat}>{subcat}</SelectItem>
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
                      <p>Provide a detailed description of your committee request</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Textarea
                id="description"
                placeholder="Describe your committee request in detail..."
                required
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  setErrors({ ...errors, description: "" });
                }}
                className={`min-h-[120px] ${errors.description ? "border-destructive" : ""}`}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{formData.description.length} characters</span>
                {errors.description && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.description}
                  </span>
                )}
              </div>
            </div>

            <Separator />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !isFormValid}
                className="min-w-[140px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Ticket"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

