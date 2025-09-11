import HeroSection from "@/components/HeroSection";
import ProductGrid from "@/components/ProductGrid";
import { type Product } from "@/components/ProductCard";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCart } from "@/context/CartContext";

export default function HomePage() {
  const { addItem } = useCart();

  // Fetch products from API and show only the first 3 as featured
  const { data: allProducts = [], isLoading, error } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const featuredProducts = allProducts.slice(0, 3); // Show first 3 products as featured

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
      <div className="min-h-screen">
        <HeroSection />
        <div className="py-16 flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-lg">Loading featured products...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <HeroSection />
        <div className="py-16 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">Unable to load featured products</h2>
            <p className="text-muted-foreground">Please try refreshing the page</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <HeroSection />
      <ProductGrid 
        products={featuredProducts}
        title="Featured Collection"
        onAddToCart={handleAddToCart}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}