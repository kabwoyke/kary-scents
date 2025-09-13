import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import StarRating from "@/components/StarRating";
import { MessageSquare, Star } from "lucide-react";

const reviewFormSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5, "Rating must be between 1 and 5"),
  content: z
    .string()
    .min(10, "Review must be at least 10 characters")
    .max(500, "Review must be less than 500 characters"),
  customerName: z.string().optional(),
});

type ReviewFormData = z.infer<typeof reviewFormSchema>;

interface ReviewFormProps {
  productId: string;
  productName: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export default function ReviewForm({
  productId,
  productName,
  onSuccess,
  onCancel,
  className,
}: ReviewFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [characterCount, setCharacterCount] = useState(0);

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: 0,
      content: "",
      customerName: "",
    },
  });

  const { watch } = form;
  const rating = watch("rating");
  const content = watch("content");

  // Update character count when content changes
  useEffect(() => {
    setCharacterCount(content?.length || 0);
  }, [content]);

  const submitReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      const response = await fetch(`/api/products/${productId}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error("Failed to submit review");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Review Submitted!",
        description: "Thank you for your review. It will be published after moderation.",
      });
      
      // Invalidate reviews cache
      queryClient.invalidateQueries({ 
        queryKey: ["/api/products", productId, "reviews"] 
      });
      
      // Reset form
      form.reset();
      setCharacterCount(0);
      
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReviewFormData) => {
    submitReviewMutation.mutate(data);
  };

  const getRatingText = (rating: number) => {
    const ratingTexts = {
      1: "Poor",
      2: "Fair", 
      3: "Good",
      4: "Very Good",
      5: "Excellent"
    };
    return ratingTexts[rating as keyof typeof ratingTexts] || "";
  };

  return (
    <Card className={className} data-testid="review-form">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Write a Review
        </CardTitle>
        <CardDescription>
          Share your experience with {productName}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Rating Field */}
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Star className="w-4 h-4" />
                    Rating
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <StarRating
                        rating={field.value}
                        interactive
                        size="lg"
                        onRatingChange={field.onChange}
                        data-testid="review-form-rating"
                      />
                      {rating > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {getRatingText(rating)} ({rating}/5)
                        </p>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Review Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Review</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Tell us about your experience with this perfume..."
                        className="min-h-[120px] resize-none"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setCharacterCount(e.target.value.length);
                        }}
                        data-testid="review-form-content"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Minimum 10 characters</span>
                        <span 
                          className={characterCount > 500 ? "text-destructive" : ""}
                          data-testid="character-count"
                        >
                          {characterCount}/500
                        </span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Customer Name (Optional) */}
            <FormField
              control={form.control}
              name="customerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Name (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your name to display with the review"
                      {...field}
                      data-testid="review-form-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={submitReviewMutation.isPending}
                className="flex-1"
                data-testid="button-submit-review"
              >
                {submitReviewMutation.isPending ? "Submitting..." : "Submit Review"}
              </Button>
              
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={submitReviewMutation.isPending}
                  data-testid="button-cancel-review"
                >
                  Cancel
                </Button>
              )}
            </div>

            {/* Info Message */}
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> All reviews are moderated before being published. 
                Your review will be visible once approved by our team.
              </p>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}