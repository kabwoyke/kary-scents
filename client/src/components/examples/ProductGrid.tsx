import ProductGrid from '../ProductGrid';
import perfume1 from "@assets/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png";
import perfume2 from "@assets/generated_images/Premium_Arabic_perfume_bottle_17638015.png";
import collectionUrl from "@assets/generated_images/Arabic_perfume_collection_display_7e73a28e.png";

export default function ProductGridExample() {
  // todo: remove mock functionality
  const mockProducts = [
    {
      id: "1",
      name: "Oud Al Maktoub",
      price: 4500,
      originalPrice: 5500,
      image: perfume1,
      category: "Arabic Fragrances",
      description: "A luxurious blend of traditional oud and modern elegance",
      isNew: true,
    },
    {
      id: "2", 
      name: "Rose Damascena",
      price: 3200,
      image: perfume2,
      category: "Floral Scents",
      description: "Delicate Damascus rose with subtle woody undertones",
    },
    {
      id: "3",
      name: "Amber Nights",
      price: 3800,
      image: collectionUrl,
      category: "Oriental",
      description: "Warm amber and spices for evening occasions",
      isFavorite: true,
    },
    {
      id: "4",
      name: "Jasmine Royal",
      price: 2900,
      image: perfume1,
      category: "Floral Scents", 
      description: "Pure jasmine with hints of sandalwood",
    },
    {
      id: "5",
      name: "Musk Al Tahara",
      price: 2200,
      originalPrice: 2800,
      image: perfume2,
      category: "Arabic Fragrances",
      description: "Traditional white musk, pure and clean",
    },
  ];

  const handleAddToCart = (product: any) => {
    console.log('Added to cart:', product);
  };

  const handleToggleFavorite = (productId: string) => {
    console.log('Toggled favorite for:', productId);
  };

  return (
    <ProductGrid 
      products={mockProducts}
      onAddToCart={handleAddToCart}
      onToggleFavorite={handleToggleFavorite}
    />
  );
}