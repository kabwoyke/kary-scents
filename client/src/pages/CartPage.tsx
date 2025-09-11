import { useState } from "react";
import ShoppingCart, { type CartItem } from "@/components/ShoppingCart";
import perfume1 from "@assets/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png";
import perfume2 from "@assets/generated_images/Premium_Arabic_perfume_bottle_17638015.png";

export default function CartPage() {
  // todo: remove mock functionality - replace with cart context/state management
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: "1",
      name: "Oud Al Maktoub",
      price: 4500,
      image: perfume1,
      quantity: 2,
      category: "Arabic Fragrances",
    },
    {
      id: "2",
      name: "Rose Damascena", 
      price: 3200,
      image: perfume2,
      quantity: 1,
      category: "Floral Scents",
    },
  ]);

  const handleUpdateQuantity = (id: string, quantity: number) => {
    setCartItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, quantity } : item
      )
    );
    console.log('Updated quantity for item:', id, 'to:', quantity);
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
    console.log('Removed item from cart:', id);
  };

  const handleCheckout = (deliveryLocation: string) => {
    // todo: remove mock functionality - integrate with payment system
    console.log('Proceeding to checkout with delivery location:', deliveryLocation);
    console.log('Cart items:', cartItems);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-serif font-bold text-foreground mb-8">
            Shopping Cart
          </h1>
        </div>
      </div>
      
      <ShoppingCart 
        items={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onRemoveItem={handleRemoveItem}
        onCheckout={handleCheckout}
      />
    </div>
  );
}