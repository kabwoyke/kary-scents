import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  deliveryLocation: "nairobi-cbd" | "nairobi-other";
  paymentMethod: "stripe" | "mpesa";
}

export default function CheckoutPage() {
  const { state, clearCart } = useCart();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [formData, setFormData] = useState<CheckoutFormData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
    deliveryLocation: "nairobi-cbd",
    paymentMethod: "stripe",
  });

  const deliveryCharges = {
    "nairobi-cbd": 200,
    "nairobi-other": 300,
  };

  const deliveryCharge = deliveryCharges[formData.deliveryLocation];
  const total = state.total + deliveryCharge;

  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });
      if (!response.ok) {
        throw new Error("Failed to create order");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Order placed successfully!",
        description: `Your order #${data.id} has been received. We'll contact you soon.`,
      });
      clearCart();
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Order failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof CheckoutFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone || !formData.address) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Create order data
    const orderData = {
      order: {
        customerName: `${formData.firstName} ${formData.lastName}`,
        customerEmail: formData.email,
        customerPhone: formData.phone,
        deliveryAddress: formData.address,
        deliveryLocation: formData.deliveryLocation,
        deliveryCharge,
        subtotal: state.total,
        total,
        paymentMethod: formData.paymentMethod,
        status: "pending" as const,
      },
      items: state.items.map(item => ({
        productId: item.id,
        productName: item.name,
        productPrice: item.price,
        quantity: item.quantity,
      })),
    };

    createOrderMutation.mutate(orderData);
  };

  // Redirect if cart is empty
  useEffect(() => {
    if (state.items.length === 0) {
      setLocation("/cart");
    }
  }, [state.items.length, setLocation]);

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => setLocation("/cart")}
            className="mb-4"
            data-testid="button-back-cart"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Cart
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Checkout</h1>
          <p className="text-muted-foreground mt-2">
            Complete your order for {state.itemCount} {state.itemCount === 1 ? 'item' : 'items'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Checkout Form */}
            <div className="space-y-6">
              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={(e) => handleInputChange("firstName", e.target.value)}
                        required
                        data-testid="input-first-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={(e) => handleInputChange("lastName", e.target.value)}
                        required
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      required
                      data-testid="input-email"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      placeholder="0712345678"
                      required
                      data-testid="input-phone"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Delivery Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="address">Delivery Address *</Label>
                    <Input
                      id="address"
                      value={formData.address}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      placeholder="Enter your full delivery address"
                      required
                      data-testid="input-address"
                    />
                  </div>

                  <div>
                    <Label>Delivery Location</Label>
                    <RadioGroup
                      value={formData.deliveryLocation}
                      onValueChange={(value) => handleInputChange("deliveryLocation", value)}
                      className="mt-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nairobi-cbd" id="nairobi-cbd" data-testid="radio-nairobi-cbd" />
                        <Label htmlFor="nairobi-cbd">Nairobi CBD (KSh 200)</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="nairobi-other" id="nairobi-other" data-testid="radio-nairobi-other" />
                        <Label htmlFor="nairobi-other">Other Nairobi Areas (KSh 300)</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={(value) => handleInputChange("paymentMethod", value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="stripe" id="stripe" data-testid="radio-stripe" />
                      <Label htmlFor="stripe">Credit/Debit Card (Stripe)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mpesa" id="mpesa" data-testid="radio-mpesa" />
                      <Label htmlFor="mpesa">M-Pesa (Coming Soon)</Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Order Summary */}
            <div>
              <Card className="sticky top-8">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Order Items */}
                  <div className="space-y-3">
                    {state.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span>{item.name} x {item.quantity}</span>
                        <span>KSh {(item.price * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>KSh {state.total.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Delivery</span>
                      <span>KSh {deliveryCharge.toLocaleString()}</span>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">KSh {total.toLocaleString()}</span>
                  </div>

                  <Button
                    type="submit"
                    className="w-full mt-6"
                    size="lg"
                    disabled={createOrderMutation.isPending || formData.paymentMethod === "mpesa"}
                    data-testid="button-place-order"
                  >
                    {createOrderMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      `Place Order - KSh ${total.toLocaleString()}`
                    )}
                  </Button>

                  {formData.paymentMethod === "mpesa" && (
                    <p className="text-sm text-muted-foreground text-center">
                      M-Pesa integration coming soon
                    </p>
                  )}

                  <div className="text-sm text-muted-foreground pt-4">
                    <p>• Contact: 0792246027</p>
                    <p>• We'll call to confirm your order</p>
                    <p>• Payment on delivery available</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}