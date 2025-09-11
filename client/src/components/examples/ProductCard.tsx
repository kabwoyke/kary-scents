import ProductCard from '../ProductCard';
import perfumeUrl from "@assets/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png";

export default function ProductCardExample() {
  const mockProduct = {
    id: "1",
    name: "Oud Al Maktoub",
    price: 4500,
    originalPrice: 5500,
    image: perfumeUrl,
    category: "Arabic Fragrances",
    description: "A luxurious blend of traditional oud and modern elegance, perfect for special occasions",
    isNew: true,
    isFavorite: false,
  };

  const handleAddToCart = (product: any) => {
    console.log('Added to cart:', product);
  };

  const handleToggleFavorite = (productId: string) => {
    console.log('Toggled favorite for:', productId);
  };

  return (
    <div className="w-80">
      <ProductCard 
        product={mockProduct}
        onAddToCart={handleAddToCart}
        onToggleFavorite={handleToggleFavorite}
      />
    </div>
  );
}