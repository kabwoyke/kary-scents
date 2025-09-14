import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingCart, Heart, Star, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/hooks/use-toast";
import ReviewForm from "@/components/ReviewForm";
import ReviewList from "@/components/ReviewList";
import { RatingDisplay } from "@/components/StarRating";
import { type Product } from "@/components/ProductCard";
import { useSEO, getProductSEO } from "@/hooks/use-seo";

interface ReviewData {
  averageRating: number;
  totalReviews: number;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [isFavorited, setIsFavorited] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Fetch product data
  const { data: products = [], isLoading: productsLoading, error: productsError } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Fetch reviews for this product
  const { data: reviewData } = useQuery<ReviewData>({
    queryKey: [`/api/products/${id}/reviews`],
    enabled: !!id,
  });

  const product = products.find(p => p.id === id);
  
  // Set dynamic SEO for product page
  useSEO(product ? getProductSEO(product.name, product.id, product.description) : {
    title: "Product Not Found - Kary Perfumes",
    description: "The product you're looking for was not found. Browse our collection of premium Arabic perfumes and luxury fragrances.",
  });

  const handleAddToCart = async () => {
    if (!product) return;
    
    setIsAddingToCart(true);
    
    // Simulate loading time for better UX
    setTimeout(() => {
      addItem(product);
      setIsAddingToCart(false);
      toast({
        title: "Added to cart!",
        description: `${product.name} has been added to your cart.`,
      });
    }, 500);
  };

  const handleToggleFavorite = () => {
    setIsFavorited(!isFavorited);
    toast({
      title: isFavorited ? "Removed from favorites" : "Added to favorites",
      description: isFavorited 
        ? `${product?.name} removed from favorites`
        : `${product?.name} added to favorites`,
    });
  };

  if (productsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (productsError || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Product Not Found</h1>
          <p className="text-muted-foreground">The product you're looking for doesn't exist.</p>
          <Link href="/shop">
            <Button>Browse Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <div className="mb-6">
          <Link href="/shop">
            <Button variant="ghost" className="gap-2" data-testid="button-back-to-shop">
              <ArrowLeft className="h-4 w-4" />
              Back to Shop
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
              <img 
                src={product.image} 
                alt={product.name}
                className="w-full h-full object-cover"
                data-testid={`img-product-${product.id}`}
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
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground uppercase tracking-wide">
                {product.category}
              </p>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground" data-testid={`text-product-title-${product.id}`}>
                {product.name}
              </h1>
              <p className="text-lg text-muted-foreground">
                Premium Arabic Perfume
              </p>
            </div>

            {/* Price */}
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground" data-testid={`text-product-price-${product.id}`}>
                Ksh {product.price.toLocaleString()}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-muted-foreground line-through">
                  Ksh {product.originalPrice.toLocaleString()}
                </span>
              )}
            </div>

            {/* Reviews Summary */}
            {reviewData && reviewData.totalReviews > 0 && (
              <div>
                <RatingDisplay
                  rating={reviewData.averageRating}
                  totalReviews={reviewData.totalReviews}
                  size="lg"
                />
              </div>
            )}

            <Separator />

            {/* Description */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Description</h3>
              <p className="text-muted-foreground leading-relaxed">
                {product.description}
              </p>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                size="lg"
                className="w-full h-12 text-base"
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                data-testid={`button-add-cart-${product.id}`}
              >
                {isAddingToCart ? (
                  "Adding to Cart..."
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    Add to Cart - Ksh {product.price.toLocaleString()}
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="w-full h-12 text-base"
                onClick={handleToggleFavorite}
                data-testid={`button-favorite-${product.id}`}
              >
                <Heart className={`w-5 h-5 mr-2 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
                {isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
              </Button>
            </div>

            {/* Additional Info */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Free Delivery</span>
                  <span className="font-medium">On orders over Ksh 5,000</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Authentic Products</span>
                  <span className="font-medium">100% Genuine</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Support</span>
                  <span className="font-medium">WhatsApp: 0792246027</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="mt-12">
          <Tabs defaultValue="reviews" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="reviews" className="gap-2">
                <Star className="h-4 w-4" />
                Reviews ({reviewData?.totalReviews || 0})
              </TabsTrigger>
              <TabsTrigger value="write-review" className="gap-2">
                <MessageCircle className="h-4 w-4" />
                Write a Review
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="mt-6">
              <ReviewList productId={product.id} productName={product.name} />
            </TabsContent>

            <TabsContent value="write-review" className="mt-6">
              <ReviewForm 
                productId={product.id}
                productName={product.name}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}