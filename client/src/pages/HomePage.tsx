import HeroSection from "@/components/HeroSection";
import ProductGrid from "@/components/ProductGrid";
import { type Product } from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";

export default function HomePage() {
  const { addItem } = useCart();

  const handleAddToCart = (product: Product) => {
    addItem(product);
    console.log('Added to cart:', product.name);
  };

  const handleToggleFavorite = (productId: string) => {
    // Future implementation for favorites
    console.log('Toggled favorite for product:', productId);
  };

  return (
    <div className="min-h-screen">
      <HeroSection />
      <ProductGrid 
        title="Featured Collection"
        onAddToCart={handleAddToCart}
        onToggleFavorite={handleToggleFavorite}
        showPagination={false}
        initialPageSize={3}
      />
    </div>
  );
}