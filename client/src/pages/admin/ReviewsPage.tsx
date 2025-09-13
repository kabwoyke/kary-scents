import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ReviewCard, { Review } from "@/components/ReviewCard";
import { 
  MessageSquare, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Star,
  TrendingUp,
  Users,
  LogOut,
  Plus,
  Edit,
  Trash2,
  Search,
  Filter
} from "lucide-react";

interface AdminReviewsData {
  reviews: Review[];
  total: number;
  limit: number;
  offset: number;
}

interface ReviewStats {
  totalReviews: number;
  pendingReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
}

const reviewFormSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  customerName: z.string().min(1, "Customer name is required").optional(),
  rating: z.number().min(1, "Rating must be at least 1").max(5, "Rating cannot exceed 5"),
  content: z.string().min(10, "Content must be at least 10 characters"),
  status: z.enum(["pending", "approved", "rejected"]),
});

type ReviewFormData = z.infer<typeof reviewFormSchema>;

export default function AdminReviewsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<"pending" | "all">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);

  // Form initialization
  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      productId: "",
      customerName: "",
      rating: 5,
      content: "",
      status: "pending",
    },
  });

  const offset = (currentPage - 1) * limit;

  // Fetch filtered reviews with search
  const { 
    data: reviewsData, 
    isLoading: reviewsLoading, 
    error: reviewsError 
  } = useQuery<AdminReviewsData>({
    queryKey: ["/api/admin/reviews", selectedStatus, searchQuery, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());
      
      if (selectedStatus !== "all") {
        params.append('status', selectedStatus);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      const endpoint = searchQuery ? "/api/admin/reviews/search" : "/api/admin/reviews";
      const response = await fetch(`${endpoint}?${params}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch reviews");
      }
      return response.json();
    },
  });

  // Fetch all reviews for accurate statistics (separate query)
  const { data: allReviewsData } = useQuery<AdminReviewsData>({
    queryKey: ["/api/admin/reviews", "all-stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/reviews", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch all reviews for stats");
      }
      return response.json();
    },
  });

  // Calculate accurate review statistics from all reviews
  const stats: ReviewStats = {
    totalReviews: allReviewsData?.total || 0,
    pendingReviews: allReviewsData?.reviews.filter(r => r.status === "pending").length || 0,
    approvedReviews: allReviewsData?.reviews.filter(r => r.status === "approved").length || 0,
    rejectedReviews: allReviewsData?.reviews.filter(r => r.status === "rejected").length || 0,
  };

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      return apiRequest("POST", "/api/admin/reviews", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create review",
        variant: "destructive",
      });
    },
  });

  // Update review mutation
  const updateReviewMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReviewFormData }) => {
      return apiRequest("PUT", `/api/admin/reviews/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingReview(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update review",
        variant: "destructive",
      });
    },
  });

  // Update review status mutation
  const updateReviewStatusMutation = useMutation({
    mutationFn: async ({ reviewId, status }: { reviewId: string; status: "approved" | "rejected" }) => {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to update review status");
      }
      return response.json();
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Success",
        description: `Review ${variables.status} successfully`,
      });
      
      // Invalidate queries to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update review status",
        variant: "destructive",
      });
    },
  });

  // Delete review mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/admin/reviews/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/reviews"] });
      toast({
        title: "Success",
        description: "Review deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete review",
        variant: "destructive",
      });
    },
  });

  // Handler functions
  const handleSubmit = (data: ReviewFormData) => {
    if (editingReview) {
      updateReviewMutation.mutate({ id: editingReview.id, data });
    } else {
      createReviewMutation.mutate(data);
    }
  };

  const handleEdit = (review: Review) => {
    setEditingReview(review);
    form.reset({
      productId: review.productId,
      customerName: review.customerName || "",
      rating: review.rating,
      content: review.content,
      status: review.status as "pending" | "approved" | "rejected",
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (review: Review) => {
    if (confirm(`Are you sure you want to delete the review by ${review.customerName}?`)) {
      deleteReviewMutation.mutate(review.id);
    }
  };

  const handleApprove = (reviewId: string) => {
    updateReviewStatusMutation.mutate({ reviewId, status: "approved" });
  };

  const handleReject = (reviewId: string) => {
    updateReviewStatusMutation.mutate({ reviewId, status: "rejected" });
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    form.reset();
  };

  const handleCloseEditDialog = () => {
    setIsEditDialogOpen(false);
    setEditingReview(null);
    form.reset();
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
      queryClient.clear();
      setLocation("/admin/login");
    } catch (error) {
      console.error("Logout error:", error);
      setLocation("/admin/login");
    }
  };

  if (reviewsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access the admin reviews page
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/admin/login")}
              className="w-full"
              data-testid="button-go-to-login"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-serif font-bold text-primary">
                KARY SCENTS Admin
              </h1>
              <Separator orientation="vertical" className="h-6" />
              <h2 className="text-lg font-medium text-foreground">Reviews</h2>
            </div>
            <div className="flex items-center gap-4">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-review">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Review
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create New Review</DialogTitle>
                    <DialogDescription>
                      Create a manual review entry for the admin dashboard
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="productId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product ID</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter product ID" 
                                  data-testid="input-product-id"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="customerName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Customer Name</FormLabel>
                              <FormControl>
                                <Input 
                                  placeholder="Enter customer name" 
                                  data-testid="input-customer-name"
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name="rating"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Rating (1-5 stars)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number"
                                min="1"
                                max="5"
                                placeholder="Enter rating" 
                                data-testid="input-rating"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Review Content</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Enter review content" 
                                className="min-h-[100px]"
                                data-testid="input-content"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="approved">Approved</SelectItem>
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-3 pt-4">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsCreateDialogOpen(false)}
                          data-testid="button-cancel-create"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createReviewMutation.isPending}
                          data-testid="button-save-review"
                        >
                          {createReviewMutation.isPending ? "Creating..." : "Create Review"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                onClick={() => setLocation("/admin/dashboard")}
                data-testid="button-dashboard"
              >
                Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                data-testid="button-admin-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Review Management</h2>
          <p className="text-muted-foreground">
            Moderate customer reviews and maintain quality standards
          </p>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search reviews by customer name or comment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-reviews"
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedStatus} onValueChange={(value: "pending" | "all") => setSelectedStatus(value)}>
              <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reviews</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Reviews</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-reviews">
                    {stats.totalReviews}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All time reviews
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Reviews</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-reviews">
                    {stats.pendingReviews}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting moderation
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved Reviews</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-approved-reviews">
                    {stats.approvedReviews}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Published reviews
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected Reviews</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {reviewsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-rejected-reviews">
                    {stats.rejectedReviews}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Rejected reviews
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filter Tabs */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Reviews to Moderate</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant={selectedStatus === "pending" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("pending")}
                  data-testid="button-filter-pending"
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Pending ({stats.pendingReviews})
                </Button>
                <Button
                  variant={selectedStatus === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedStatus("all")}
                  data-testid="button-filter-all"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  All Reviews ({stats.totalReviews})
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Reviews List */}
        {reviewsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }, (_, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Skeleton className="w-8 h-8 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="w-24 h-4" />
                        <Skeleton className="w-16 h-3" />
                      </div>
                    </div>
                    <Skeleton className="w-16 h-5" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Skeleton className="w-full h-4" />
                    <Skeleton className="w-4/5 h-4" />
                    <Skeleton className="w-3/5 h-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reviewsData && reviewsData.reviews.length > 0 ? (
          <div className="space-y-4">
            {reviewsData.reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                showModerationActions={review.status === "pending"}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={updateReviewMutation.isPending}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {selectedStatus === "pending" ? "No Pending Reviews" : "No Reviews Found"}
                </h3>
                <p className="text-sm">
                  {selectedStatus === "pending" 
                    ? "All reviews have been moderated" 
                    : "No reviews have been submitted yet"
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}