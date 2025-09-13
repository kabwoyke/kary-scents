import { ShoppingCart, Heart, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Link } from "wouter";
import { ReviewListCompact } from "@/components/ReviewList";

export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  category: string;
  description: string;
  isNew?: boolean;
  isFavorite?: boolean;
}

interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onToggleFavorite?: (productId: string) => void;
}

export default function ProductCard({ 
  product, 
  onAddToCart, 
  onToggleFavorite 
}: ProductCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isFavorited, setIsFavorited] = useState(product.isFavorite || false);

  const handleAddToCart = async () => {
    setIsLoading(true);
    console.log('Adding to cart:', product.name);
    
    // Simulate API call
    setTimeout(() => {
      onAddToCart?.(product);
      setIsLoading(false);
    }, 500);
  };

  const handleToggleFavorite = () => {
    setIsFavorited(!isFavorited);
    onToggleFavorite?.(product.id);
    console.log('Toggled favorite:', product.name);
  };

  const discount = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <Card className="group hover-elevate transition-all duration-300 overflow-hidden" data-testid={`card-product-${product.id}`}>
      <div className="relative aspect-square overflow-hidden">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.isNew && (
            <Badge className="bg-primary text-primary-foreground text-xs">
              New
            </Badge>
          )}
          {discount > 0 && (
            <Badge className="bg-destructive text-destructive-foreground text-xs">
              -{discount}%
            </Badge>
          )}
        </div>

        {/* Favorite Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 bg-white/80 hover:bg-white text-black hover-elevate"
          onClick={handleToggleFavorite}
          data-testid={`button-favorite-${product.id}`}
        >
          <Heart 
            className={`h-4 w-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} 
          />
        </Button>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{product.category}</div>
          <h3 className="font-medium text-foreground truncate" data-testid={`text-product-name-${product.id}`}>
            {product.name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
          
          {/* Review Information */}
          <ReviewListCompact 
            productId={product.id}
            maxReviews={0}
            className="pt-1"
            data-testid={`reviews-${product.id}`}
          />
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 space-y-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-foreground" data-testid={`text-price-${product.id}`}>
              Ksh {product.price.toLocaleString()}
            </span>
            {product.originalPrice && (
              <span className="text-sm text-muted-foreground line-through">
                Ksh {product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 w-full">
          <Link href={`/product/${product.id}`}>
            <Button 
              variant="outline"
              size="sm"
              className="flex-1 hover-elevate"
              data-testid={`button-view-details-${product.id}`}
            >
              <Eye className="h-4 w-4 mr-1" />
              Details
            </Button>
          </Link>
          
          <Button 
            size="sm"
            onClick={handleAddToCart}
            disabled={isLoading}
            className="flex-1 hover-elevate"
            data-testid={`button-add-to-cart-${product.id}`}
          >
            {isLoading ? (
              "Adding..."
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}