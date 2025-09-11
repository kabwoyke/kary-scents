import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Link, useLocation } from "wouter";

export default function CartPage() {
  const { state, updateQuantity, removeItem } = useCart();
  const [, setLocation] = useLocation();

  const deliveryCharge = 200; // Fixed delivery charge for Nairobi CBD
  const total = state.total + deliveryCharge;

  const handleQuantityUpdate = (id: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(id);
    } else {
      updateQuantity(id, newQuantity);
    }
    console.log(`Updated quantity for ${id} to ${newQuantity}`);
  };

  const handleProceedToCheckout = () => {
    setLocation("/checkout");
  };

  if (state.items.length === 0) {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <ShoppingBag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
            <p className="text-muted-foreground mb-6">
              Discover our exquisite collection of fragrances
            </p>
            <Link href="/shop">
              <Button size="lg" data-testid="button-shop-now">
                Shop Now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Shopping Cart</h1>
          <p className="text-muted-foreground mt-2">
            {state.itemCount} {state.itemCount === 1 ? 'item' : 'items'} in your cart
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {state.items.map((item) => (
              <Card key={item.id} data-testid={`cart-item-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded-lg bg-card"
                      data-testid={`img-cart-${item.id}`}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-foreground truncate" data-testid={`text-name-${item.id}`}>
                        {item.name}
                      </h3>
                      <Badge variant="secondary" className="mt-1" data-testid={`badge-category-${item.id}`}>
                        {item.category}
                      </Badge>
                      <p className="text-xl font-bold text-primary mt-2" data-testid={`text-price-${item.id}`}>
                        KSh {item.price.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuantityUpdate(item.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <span className="w-8 text-center font-medium" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleQuantityUpdate(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-remove-${item.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between" data-testid="text-subtotal">
                  <span>Subtotal ({state.itemCount} items)</span>
                  <span>KSh {state.total.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between" data-testid="text-delivery">
                  <span>Delivery to Nairobi CBD</span>
                  <span>KSh {deliveryCharge.toLocaleString()}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-bold text-lg" data-testid="text-total">
                  <span>Total</span>
                  <span className="text-primary">KSh {total.toLocaleString()}</span>
                </div>

                <div className="space-y-3 pt-4">
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleProceedToCheckout}
                    data-testid="button-checkout"
                  >
                    Proceed to Checkout
                  </Button>
                  
                  <Link href="/shop">
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      data-testid="button-continue-shopping"
                    >
                      Continue Shopping
                    </Button>
                  </Link>
                </div>

                <div className="text-sm text-muted-foreground pt-4">
                  <p>• Free delivery within Nairobi CBD</p>
                  <p>• Secure payment processing</p>
                  <p>• Contact: 0792246027</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}