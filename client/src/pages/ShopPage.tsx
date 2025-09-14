import ProductGrid from "@/components/ProductGrid";
import { type Product } from "@/components/ProductCard";
import { useCart } from "@/context/CartContext";
import { useSEO, SEO_CONFIGS } from "@/hooks/use-seo";

export default function ShopPage() {
  const { addItem } = useCart();
  
  // Set unique SEO for shop page
  useSEO(SEO_CONFIGS.shop);

  const handleAddToCart = (product: Product) => {
    addItem(product);
    console.log('Added to cart:', product.name);
  };

  const handleToggleFavorite = (productId: string) => {
    // Future implementation for favorites
    console.log('Toggled favorite for product:', productId);
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Our Complete Collection
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover our full range of premium fragrances and luxury scents, 
            crafted for discerning customers who appreciate authentic quality.
          </p>
        </div>
      </div>
      
      <ProductGrid 
        title=""
        onAddToCart={handleAddToCart}
        onToggleFavorite={handleToggleFavorite}
        showPagination={true}
        initialPageSize={12}
      />
    </div>
  );
}