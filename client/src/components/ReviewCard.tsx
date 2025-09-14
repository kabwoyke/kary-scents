import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import StarRating from "@/components/StarRating";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle, XCircle, Clock, User, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Review {
  id: string;
  productId: string;
  rating: number;
  content: string;
  customerName?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  orderId?: string;
}

interface ReviewCardProps {
  review: Review;
  showProduct?: boolean;
  showModerationActions?: boolean;
  showAdminActions?: boolean;
  onApprove?: (reviewId: string) => void;
  onReject?: (reviewId: string) => void;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export default function ReviewCard({
  review,
  showProduct = false,
  showModerationActions = false,
  showAdminActions = false,
  onApprove,
  onReject,
  onEdit,
  onDelete,
  isLoading = false,
  className,
}: ReviewCardProps) {
  const timeAgo = formatDistanceToNow(new Date(review.createdAt), { 
    addSuffix: true 
  });

  const getStatusBadge = () => {
    switch (review.status) {
      case "approved":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200",
        review.status === "pending" && showModerationActions && "border-yellow-200 bg-yellow-50/30 dark:border-yellow-800 dark:bg-yellow-900/10",
        className
      )}
      data-testid={`review-card-${review.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full">
              <User className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground" data-testid={`review-customer-${review.id}`}>
                {review.customerName || "Anonymous Customer"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <StarRating 
                  rating={review.rating} 
                  size="sm" 
                  data-testid={`review-rating-${review.id}`}
                />
                <span className="text-xs text-muted-foreground">
                  {timeAgo}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {review.orderId && (
              <Badge variant="outline" className="text-xs">
                Verified Purchase
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-3">
          <p 
            className="text-foreground leading-relaxed" 
            data-testid={`review-content-${review.id}`}
          >
            {review.content}
          </p>

          {((showModerationActions && review.status === "pending") || showAdminActions) && (
            <div className="flex items-center gap-2 pt-2 border-t">
              {showModerationActions && review.status === "pending" && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onApprove?.(review.id)}
                    disabled={isLoading}
                    className="bg-green-600 hover:bg-green-700 text-white"
                    data-testid={`button-approve-${review.id}`}
                  >
                    <CheckCircle className="w-3 h-3 mr-1" />
                    {isLoading ? "Approving..." : "Approve"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onReject?.(review.id)}
                    disabled={isLoading}
                    data-testid={`button-reject-${review.id}`}
                  >
                    <XCircle className="w-3 h-3 mr-1" />
                    {isLoading ? "Rejecting..." : "Reject"}
                  </Button>
                </>
              )}
              
              {showAdminActions && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit?.(review)}
                    disabled={isLoading}
                    data-testid={`button-edit-${review.id}`}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => onDelete?.(review.id)}
                    disabled={isLoading}
                    data-testid={`button-delete-${review.id}`}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Skeleton loader for reviews
export function ReviewCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-muted rounded-full animate-pulse" />
            <div className="space-y-2">
              <div className="w-24 h-4 bg-muted rounded animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="w-16 h-3 bg-muted rounded animate-pulse" />
                <div className="w-12 h-3 bg-muted rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="w-16 h-5 bg-muted rounded animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="w-full h-4 bg-muted rounded animate-pulse" />
          <div className="w-4/5 h-4 bg-muted rounded animate-pulse" />
          <div className="w-3/5 h-4 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}