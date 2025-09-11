import { useState } from "react";
import { Trash2, Plus, Minus, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
  category: string;
}

interface ShoppingCartProps {
  items: CartItem[];
  onUpdateQuantity?: (id: string, quantity: number) => void;
  onRemoveItem?: (id: string) => void;
  onCheckout?: (deliveryLocation: string) => void;
}

export default function ShoppingCart({ 
  items, 
  onUpdateQuantity, 
  onRemoveItem, 
  onCheckout 
}: ShoppingCartProps) {
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  const getDeliveryCharge = () => {
    switch (deliveryLocation) {
      case "nairobi-cbd":
        return 200;
      case "other":
        return 300;
      default:
        return 0;
    }
  };

  const deliveryCharge = getDeliveryCharge();
  const total = subtotal + deliveryCharge;

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    onUpdateQuantity?.(id, newQuantity);
    console.log(`Updated quantity for ${id} to ${newQuantity}`);
  };

  const handleRemoveItem = (id: string) => {
    onRemoveItem?.(id);
    console.log(`Removed item ${id} from cart`);
  };

  const handleCheckout = () => {
    if (!deliveryLocation) {
      console.log('Please select delivery location');
      return;
    }
    onCheckout?.(deliveryLocation);
    console.log('Proceeding to checkout with delivery:', deliveryLocation);
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h2 className="text-2xl font-serif font-bold mb-4">Your Cart is Empty</h2>
        <p className="text-muted-foreground mb-8">
          Discover our beautiful collection of Arabic fragrances
        </p>
        <Link href="/shop">
          <Button className="hover-elevate" data-testid="button-continue-shopping">
            Continue Shopping
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/shop">
          <Button variant="ghost" className="hover-elevate" data-testid="button-back-to-shop">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Continue Shopping
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Shopping Cart
                <span className="text-sm font-normal text-muted-foreground">
                  {items.length} item{items.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item, index) => (
                <div key={item.id}>
                  <div className="flex items-center space-x-4" data-testid={`cart-item-${item.id}`}>
                    <img 
                      src={item.image} 
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate" data-testid={`text-item-name-${item.id}`}>
                        {item.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{item.category}</p>
                      <p className="text-sm font-medium">Ksh {item.price.toLocaleString()}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover-elevate"
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      <span className="w-8 text-center text-sm" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover-elevate"
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="text-right">
                      <p className="font-medium" data-testid={`text-item-total-${item.id}`}>
                        Ksh {(item.price * item.quantity).toLocaleString()}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive hover-elevate"
                        onClick={() => handleRemoveItem(item.id)}
                        data-testid={`button-remove-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {index < items.length - 1 && <Separator className="mt-4" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span data-testid="text-subtotal">Ksh {subtotal.toLocaleString()}</span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Delivery Location</label>
                  <Select value={deliveryLocation} onValueChange={setDeliveryLocation}>
                    <SelectTrigger data-testid="select-delivery-location">
                      <SelectValue placeholder="Select delivery location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nairobi-cbd">Nairobi CBD - Ksh 200</SelectItem>
                      <SelectItem value="other">Other Locations - Ksh 300</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {deliveryCharge > 0 && (
                  <div className="flex justify-between">
                    <span>Delivery</span>
                    <span data-testid="text-delivery-charge">Ksh {deliveryCharge.toLocaleString()}</span>
                  </div>
                )}
                
                <Separator />
                
                <div className="flex justify-between font-semibold text-lg">
                  <span>Total</span>
                  <span data-testid="text-total">Ksh {total.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full hover-elevate" 
                onClick={handleCheckout}
                disabled={!deliveryLocation}
                data-testid="button-checkout"
              >
                Proceed to Checkout
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}