import ShoppingCart from '../ShoppingCart';
import perfume1 from "@assets/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png";
import perfume2 from "@assets/generated_images/Premium_Arabic_perfume_bottle_17638015.png";

export default function ShoppingCartExample() {
  // todo: remove mock functionality
  const mockCartItems = [
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
  ];

  const handleUpdateQuantity = (id: string, quantity: number) => {
    console.log('Update quantity:', id, quantity);
  };

  const handleRemoveItem = (id: string) => {
    console.log('Remove item:', id);
  };

  const handleCheckout = (deliveryLocation: string) => {
    console.log('Checkout with delivery:', deliveryLocation);
  };

  return (
    <ShoppingCart 
      items={mockCartItems}
      onUpdateQuantity={handleUpdateQuantity}
      onRemoveItem={handleRemoveItem}
      onCheckout={handleCheckout}
    />
  );
}