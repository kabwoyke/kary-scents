import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
  LogOut
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

export default function AdminReviewsPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedStatus, setSelectedStatus] = useState<"pending" | "all">("pending");

  // Fetch filtered reviews
  const { 
    data: reviewsData, 
    isLoading: reviewsLoading, 
    error: reviewsError 
  } = useQuery<AdminReviewsData>({
    queryKey: ["/api/admin/reviews", selectedStatus],
    queryFn: async () => {
      const params = selectedStatus === "pending" ? "?status=pending" : "";
      const response = await fetch(`/api/admin/reviews${params}`, {
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

  // Mutation for updating review status
  const updateReviewMutation = useMutation({
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

  const handleApprove = (reviewId: string) => {
    updateReviewMutation.mutate({ reviewId, status: "approved" });
  };

  const handleReject = (reviewId: string) => {
    updateReviewMutation.mutate({ reviewId, status: "rejected" });
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