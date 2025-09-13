import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Product } from "@/components/ProductCard";
import ReviewList from "@/components/ReviewList";
import ReviewForm from "@/components/ReviewForm";
import { RatingDisplay } from "@/components/StarRating";
import { ShoppingCart, Heart, Eye, MessageSquare, Star, Package } from "lucide-react";

interface ProductDetailModalProps {
  product: Product;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAddToCart?: (product: Product) => void;
  onToggleFavorite?: (productId: string) => void;
}

interface ProductReviewData {
  reviews: any[];
  averageRating: number;
  totalReviews: number;
}

export default function ProductDetailModal({
  product,
  trigger,
  open,
  onOpenChange,
  onAddToCart,
  onToggleFavorite,
}: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState("details");
  const [showReviewForm, setShowReviewForm] = useState(false);

  // Fetch review data for this product
  const { data: reviewData } = useQuery<ProductReviewData>({
    queryKey: ["/api/products", product.id, "reviews"],
    queryFn: async () => {
      const response = await fetch(`/api/products/${product.id}/reviews`);
      if (!response.ok) throw new Error("Failed to fetch reviews");
      return response.json();
    },
    enabled: open, // Only fetch when modal is open
  });

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    onAddToCart?.(product);
  };

  const handleToggleFavorite = () => {
    onToggleFavorite?.(product.id);
  };

  const handleReviewSubmitted = () => {
    setShowReviewForm(false);
    setActiveTab("reviews");
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm" data-testid={`button-view-product-${product.id}`}>
      <Eye className="w-4 h-4 mr-2" />
      View Details
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>

      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-serif" data-testid={`modal-title-${product.id}`}>
            {product.name}
          </DialogTitle>
          <DialogDescription className="text-base">
            {product.category} • Premium Arabic Perfume
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 h-full">
            {/* Product Image and Basic Info */}
            <div className="p-6 space-y-4">
              {/* Product Image */}
              <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
                
                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {product.isNew && (
                    <Badge className="bg-primary text-primary-foreground">
                      New
                    </Badge>
                  )}
                  {discount > 0 && (
                    <Badge className="bg-destructive text-destructive-foreground">
                      -{discount}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Price and Actions */}
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-foreground">
                        Ksh {product.price.toLocaleString()}
                      </span>
                      {product.originalPrice && (
                        <span className="text-lg text-muted-foreground line-through">
                          Ksh {product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>

                    {/* Review Summary */}
                    {reviewData && reviewData.totalReviews > 0 && (
                      <RatingDisplay
                        rating={reviewData.averageRating}
                        totalReviews={reviewData.totalReviews}
                        size="md"
                      />
                    )}
                  </div>

                  <Separator />

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <Button 
                      className="flex-1"
                      onClick={handleAddToCart}
                      data-testid={`button-modal-add-cart-${product.id}`}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Add to Cart
                    </Button>
                    <Button 
                      variant="outline"
                      size="icon"
                      onClick={handleToggleFavorite}
                      data-testid={`button-modal-favorite-${product.id}`}
                    >
                      <Heart className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Product Details and Reviews */}
            <div className="border-l bg-muted/20">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-2 mx-6 mt-6">
                  <TabsTrigger value="details" data-testid="tab-details">
                    <Package className="w-4 h-4 mr-2" />
                    Details
                  </TabsTrigger>
                  <TabsTrigger value="reviews" data-testid="tab-reviews">
                    <Star className="w-4 h-4 mr-2" />
                    Reviews ({reviewData?.totalReviews || 0})
                  </TabsTrigger>
                </TabsList>

                {/* Product Details Tab */}
                <TabsContent value="details" className="flex-1 m-6 mt-4">
                  <ScrollArea className="h-full">
                    <div className="space-y-6 pr-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Description</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-muted-foreground leading-relaxed">
                            {product.description}
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Product Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Category:</span>
                            <span className="font-medium">{product.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Brand:</span>
                            <span className="font-medium">KARY SCENTS</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Origin:</span>
                            <span className="font-medium">Premium Collection</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Size:</span>
                            <span className="font-medium">50ml</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </ScrollArea>
                </TabsContent>

                {/* Reviews Tab */}
                <TabsContent value="reviews" className="flex-1 m-6 mt-4">
                  <ScrollArea className="h-full">
                    <div className="space-y-4 pr-4">
                      {/* Write Review Button */}
                      {!showReviewForm && (
                        <Card>
                          <CardContent className="p-4">
                            <div className="text-center">
                              <Button 
                                onClick={() => setShowReviewForm(true)}
                                data-testid={`button-write-review-${product.id}`}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Write a Review
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {/* Review Form */}
                      {showReviewForm && (
                        <ReviewForm
                          productId={product.id}
                          productName={product.name}
                          onSuccess={handleReviewSubmitted}
                          onCancel={() => setShowReviewForm(false)}
                        />
                      )}

                      {/* Reviews List */}
                      <ReviewList
                        productId={product.id}
                        productName={product.name}
                        showHeader={false}
                        maxInitialReviews={10}
                      />
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}