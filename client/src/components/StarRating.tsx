import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  className?: string;
  showRatingText?: boolean;
  disabled?: boolean;
}

export default function StarRating({
  rating,
  maxRating = 5,
  size = "md",
  interactive = false,
  onRatingChange,
  className,
  showRatingText = false,
  disabled = false,
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const handleStarClick = (starRating: number) => {
    if (!interactive || disabled) return;
    onRatingChange?.(starRating);
  };

  const handleStarHover = (starRating: number) => {
    if (!interactive || disabled) return;
    setHoverRating(starRating);
  };

  const handleMouseLeave = () => {
    if (!interactive || disabled) return;
    setHoverRating(null);
  };

  const displayRating = hoverRating ?? rating;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center" onMouseLeave={handleMouseLeave}>
        {Array.from({ length: maxRating }, (_, index) => {
          const starRating = index + 1;
          const isFilled = starRating <= displayRating;
          const isPartial = !isFilled && starRating - 0.5 <= displayRating;

          return (
            <button
              key={index}
              type="button"
              className={cn(
                "relative transition-colors duration-150",
                interactive && !disabled && "cursor-pointer hover-elevate",
                !interactive && "cursor-default",
                disabled && "cursor-not-allowed opacity-50"
              )}
              onClick={() => handleStarClick(starRating)}
              onMouseEnter={() => handleStarHover(starRating)}
              disabled={disabled}
              data-testid={`star-${starRating}`}
              aria-label={`${starRating} star${starRating !== 1 ? 's' : ''}`}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  "transition-colors duration-150",
                  isFilled
                    ? "fill-yellow-400 text-yellow-400"
                    : isPartial
                    ? "fill-yellow-200 text-yellow-400"
                    : "fill-transparent text-muted-foreground hover:text-yellow-400"
                )}
              />
            </button>
          );
        })}
      </div>

      {showRatingText && (
        <span
          className={cn(
            textSizeClasses[size],
            "text-muted-foreground ml-1",
            interactive && hoverRating && "text-foreground"
          )}
          data-testid="rating-text"
        >
          {(hoverRating ?? rating).toFixed(1)}
        </span>
      )}
    </div>
  );
}

// Helper component for displaying just the rating value with stars
export function RatingDisplay({
  rating,
  totalReviews,
  size = "sm",
  className,
}: {
  rating: number;
  totalReviews?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const textSizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <StarRating rating={rating} size={size} showRatingText />
      {totalReviews !== undefined && (
        <span
          className={cn(
            textSizeClasses[size],
            "text-muted-foreground"
          )}
          data-testid="total-reviews"
        >
          ({totalReviews})
        </span>
      )}
    </div>
  );
}