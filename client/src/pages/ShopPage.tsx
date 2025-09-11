import ProductGrid from "@/components/ProductGrid";
import { type Product } from "@/components/ProductCard";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";

export default function ShopPage() {
  const { addItem } = useCart();

  // Fetch products from API
  const { data: products = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const handleAddToCart = (product: Product) => {
    addItem(product);
    console.log('Added to cart:', product.name);
  };

  const handleToggleFavorite = (productId: string) => {
    // Future implementation for favorites
    console.log('Toggled favorite for product:', productId);
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-lg">Loading products...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Unable to load products</h2>
          <p className="text-muted-foreground">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Our Complete Collection
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover our full range of premium Arabic fragrances and luxury scents, 
            crafted for discerning customers who appreciate authentic quality.
          </p>
        </div>
      </div>
      
      <ProductGrid 
        products={products}
        title=""
        onAddToCart={handleAddToCart}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}