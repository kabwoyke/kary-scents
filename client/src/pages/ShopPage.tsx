import ProductGrid from "@/components/ProductGrid";
import { type Product } from "@/components/ProductCard";
import perfume1 from "@assets/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png";
import perfume2 from "@assets/generated_images/Premium_Arabic_perfume_bottle_17638015.png";
import collectionUrl from "@assets/generated_images/Arabic_perfume_collection_display_7e73a28e.png";

export default function ShopPage() {
  // todo: remove mock functionality - replace with API call
  const allProducts: Product[] = [
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
    {
      id: "4",
      name: "Jasmine Royal",
      price: 2900,
      image: perfume1,
      category: "Floral Scents", 
      description: "Pure jasmine essence with hints of sandalwood for a royal experience",
    },
    {
      id: "5",
      name: "Musk Al Tahara",
      price: 2200,
      originalPrice: 2800,
      image: perfume2,
      category: "Arabic Fragrances",
      description: "Traditional white musk, pure and clean for daily wear",
    },
    {
      id: "6",
      name: "Saffron Gold",
      price: 5200,
      image: collectionUrl,
      category: "Premium Collection",
      description: "Exclusive saffron-infused fragrance with gold accents",
      isNew: true,
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
        products={allProducts}
        title=""
        onAddToCart={handleAddToCart}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}