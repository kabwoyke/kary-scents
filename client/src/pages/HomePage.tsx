import HeroSection from "@/components/HeroSection";
import ProductGrid from "@/components/ProductGrid";
import { type Product } from "@/components/ProductCard";
import perfume1 from "@assets/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png";
import perfume2 from "@assets/generated_images/Premium_Arabic_perfume_bottle_17638015.png";
import collectionUrl from "@assets/generated_images/Arabic_perfume_collection_display_7e73a28e.png";

export default function HomePage() {
  // todo: remove mock functionality - replace with API call
  const featuredProducts: Product[] = [
    {
      id: "1",
      name: "Oud Al Maktoub",
      price: 4500,
      originalPrice: 5500,
      image: perfume1,
      category: "Arabic Fragrances",
      description: "A luxurious blend of traditional oud and modern elegance, perfect for special occasions",
      isNew: true,
    },
    {
      id: "2", 
      name: "Rose Damascena",
      price: 3200,
      image: perfume2,
      category: "Floral Scents",
      description: "Delicate Damascus rose with subtle woody undertones for everyday elegance",
    },
    {
      id: "3",
      name: "Amber Nights",
      price: 3800,
      image: collectionUrl,
      category: "Oriental",
      description: "Warm amber and exotic spices for evening occasions and special moments",
      isFavorite: true,
    },
  ];

  const handleAddToCart = (product: Product) => {
    // todo: remove mock functionality - integrate with cart context
    console.log('Added to cart:', product.name);
  };

  const handleToggleFavorite = (productId: string) => {
    // todo: remove mock functionality - integrate with favorites system
    console.log('Toggled favorite for product:', productId);
  };

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