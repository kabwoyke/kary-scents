import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import ReviewCard, { Review, ReviewCardSkeleton } from "@/components/ReviewCard";
import { RatingDisplay } from "@/components/StarRating";
import { MessageSquare, SortAsc, SortDesc, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReviewListData {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

interface ReviewListProps {
  productId: string;
  productName: string;
  showHeader?: boolean;
  maxInitialReviews?: number;
  className?: string;
}

type SortOption = "newest" | "oldest" | "highest-rating" | "lowest-rating";

export default function ReviewList({
  productId,
  productName,
  showHeader = true,
  maxInitialReviews = 5,
  className,
}: ReviewListProps) {
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showAll, setShowAll] = useState(false);

  // Fetch reviews for the product
  const { 
    data: reviewData, 
    isLoading, 
    error 
  } = useQuery<ReviewListData>({
    queryKey: ["/api/products", productId, "reviews"],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/reviews`);
      if (!response.ok) {
        throw new Error("Failed to fetch reviews");
      }
      return response.json();
    },
  });

  // Sort reviews based on selected option
  const sortedReviews = reviewData?.reviews ? [...reviewData.reviews].sort((a, b) => {
    switch (sortBy) {
      case "newest":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "oldest":
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      case "highest-rating":
        return b.rating - a.rating;
      case "lowest-rating":
        return a.rating - b.rating;
      default:
        return 0;
    }
  }) : [];

  // Determine how many reviews to show
  const reviewsToShow = showAll ? sortedReviews : sortedReviews.slice(0, maxInitialReviews);
  const hasMoreReviews = sortedReviews.length > maxInitialReviews;

  const getSortLabel = (option: SortOption) => {
    const labels = {
      "newest": "Newest First",
      "oldest": "Oldest First", 
      "highest-rating": "Highest Rating",
      "lowest-rating": "Lowest Rating"
    };
    return labels[option];
  };

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="w-8 h-8 mx-auto mb-2" />
            <p>Failed to load reviews. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("space-y-4", className)} data-testid="review-list">
      {showHeader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              Customer Reviews
            </CardTitle>
            <CardDescription>
              Reviews for {productName}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <div className="w-32 h-6 bg-muted rounded animate-pulse" />
                <div className="w-24 h-4 bg-muted rounded animate-pulse" />
              </div>
            ) : reviewData ? (
              <div className="space-y-4">
                {/* Rating Summary */}
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <RatingDisplay
                      rating={reviewData.averageRating}
                      totalReviews={reviewData.totalReviews}
                      size="md"
                      data-testid="average-rating"
                    />
                    <p className="text-sm text-muted-foreground">
                      Based on {reviewData.totalReviews} review{reviewData.totalReviews !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Sort Options */}
                  {reviewData.totalReviews > 1 && (
                    <div className="flex items-center gap-2">
                      <SortAsc className="w-4 h-4 text-muted-foreground" />
                      <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                        <SelectTrigger className="w-40" data-testid="sort-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="highest-rating">Highest Rating</SelectItem>
                          <SelectItem value="lowest-rating">Lowest Rating</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {reviewData.totalReviews > 0 && <Separator />}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, index) => (
            <ReviewCardSkeleton key={index} />
          ))}
        </div>
      ) : reviewData && reviewData.totalReviews > 0 ? (
        <div className="space-y-4">
          {reviewsToShow.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              data-testid={`review-item-${review.id}`}
            />
          ))}

          {/* Show More/Less Button */}
          {hasMoreReviews && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAll(!showAll)}
                data-testid="button-show-more-reviews"
              >
                {showAll ? (
                  <>
                    <SortDesc className="w-4 h-4 mr-2" />
                    Show Less Reviews
                  </>
                ) : (
                  <>
                    <SortAsc className="w-4 h-4 mr-2" />
                    Show All {sortedReviews.length} Reviews
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      ) : reviewData && reviewData.totalReviews === 0 ? (
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                No Reviews Yet
              </h3>
              <p className="text-sm">
                Be the first to share your experience with {productName}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// Compact version for use in product cards
export function ReviewListCompact({
  productId,
  maxReviews = 2,
  className,
}: {
  productId: string;
  maxReviews?: number;
  className?: string;
}) {
  const { data: reviewData, isLoading } = useQuery<ReviewListData>({
    queryKey: ["/api/products", productId, "reviews"],
    queryFn: async () => {
      const response = await fetch(`/api/products/${productId}/reviews`);
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="w-24 h-4 bg-muted rounded animate-pulse" />
        <div className="w-32 h-3 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (!reviewData || reviewData.totalReviews === 0) {
    return (
      <div className={className}>
        <p className="text-xs text-muted-foreground">No reviews yet</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <RatingDisplay
        rating={reviewData.averageRating}
        totalReviews={reviewData.totalReviews}
        size="sm"
      />
      
      {maxReviews > 0 && reviewData.reviews.length > 0 && (
        <div className="space-y-1">
          {reviewData.reviews.slice(0, maxReviews).map((review) => (
            <p key={review.id} className="text-xs text-muted-foreground line-clamp-2">
              "{review.content}"
            </p>
          ))}
        </div>
      )}
    </div>
  );
}