import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/context/CartContext";
import { useLocation } from "wouter";
import { Loader2, ArrowLeft, Smartphone, CreditCard } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

interface CheckoutFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  deliveryLocation: "nairobi-cbd" | "nairobi-other";
  paymentMethod: "stripe" | "mpesa";
  mpesaPhone: string;
}

interface PaymentStatus {
  orderId: string;
  status: string;
  paymentMethod: string;
  mpesaStatus: string;
  paidAt?: string;
  mpesaReceiptNumber?: string;
  total: number;
}

// Stripe Payment Form Component
function StripePaymentForm({ 
  clientSecret, 
  onSuccess, 
  onError, 
  orderTotal 
}: { 
  clientSecret: string; 
  onSuccess: (paymentIntentId: string) => void; 
  onError: (error: string) => void;
  orderTotal: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout`,
      },
      redirect: 'if_required'
    });

    setIsProcessing(false);

    if (error) {
      onError(error.message || "Payment failed");
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      onError("Payment confirmation failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/30 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Complete Your Payment</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Total: <span className="font-semibold text-foreground">KSh {orderTotal.toLocaleString()}</span>
        </p>
        <PaymentElement />
      </div>
      
      <Button 
        type="submit" 
        className="w-full" 
        size="lg"
        disabled={!stripe || isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing Payment...
          </>
        ) : (
          `Pay KSh ${orderTotal.toLocaleString()}`
        )}
      </Button>
    </form>
  );
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
    mpesaPhone: "",
  });

  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [isWaitingForPayment, setIsWaitingForPayment] = useState(false);
  const [paymentPollingEnabled, setPaymentPollingEnabled] = useState(false);
  const [paymentStartTime, setPaymentStartTime] = useState<number | null>(null);
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [paymentTimeoutReached, setPaymentTimeoutReached] = useState(false);
  
  // Payment timeout (5 minutes)
  const PAYMENT_TIMEOUT_MS = 5 * 60 * 1000;

  // Initialize Stripe
  const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  console.log('Stripe public key available:', !!stripePublicKey);
  
  if (!stripePublicKey) {
    console.error('VITE_STRIPE_PUBLIC_KEY environment variable is not set');
  }
  
  const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

  const deliveryCharges = {
    "nairobi-cbd": 200,
    "nairobi-other": 300,
  };

  const deliveryCharge = deliveryCharges[formData.deliveryLocation];
  const total = state.total + deliveryCharge;

  // Payment status polling for Mpesa payments
  const { data: paymentStatus, isError: paymentStatusError } = useQuery<PaymentStatus>({
    queryKey: ['/api/orders', currentOrderId, 'payment-status'],
    enabled: paymentPollingEnabled && !!currentOrderId && !paymentTimeoutReached,
    refetchInterval: 2000, // Poll every 2 seconds
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Check for payment timeout
  useEffect(() => {
    if (paymentStartTime && isWaitingForPayment) {
      const timeoutId = setTimeout(() => {
        if (isWaitingForPayment) {
          setPaymentTimeoutReached(true);
          setPaymentPollingEnabled(false);
          setIsWaitingForPayment(false);
          toast({
            title: "Payment timeout",
            description: "Payment is taking longer than expected. Please check your M-Pesa messages or contact support if payment was deducted.",
            variant: "destructive",
          });
        }
      }, PAYMENT_TIMEOUT_MS);

      return () => clearTimeout(timeoutId);
    }
  }, [paymentStartTime, isWaitingForPayment, toast]);

  // Handle payment status polling errors
  useEffect(() => {
    if (paymentStatusError && isWaitingForPayment) {
      toast({
        title: "Connection error",
        description: "Unable to check payment status. Please check your connection.",
        variant: "destructive",
      });
    }
  }, [paymentStatusError, isWaitingForPayment, toast]);

  // Stop polling and show success when payment is complete
  useEffect(() => {
    if (paymentStatus && paymentStatus.mpesaStatus === 'paid') {
      setPaymentPollingEnabled(false);
      setIsWaitingForPayment(false);
      toast({
        title: "Payment successful!",
        description: `Your M-Pesa payment has been confirmed. Receipt: ${paymentStatus.mpesaReceiptNumber}`,
      });
      clearCart();
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    } else if (paymentStatus && paymentStatus.mpesaStatus === 'failed') {
      setPaymentPollingEnabled(false);
      setIsWaitingForPayment(false);
      toast({
        title: "Payment failed",
        description: "Your M-Pesa payment was not successful. Please try again.",
        variant: "destructive",
      });
    }
  }, [paymentStatus, clearCart, setLocation, toast]);

  // Mpesa payment mutation
  // Resend STK Push mutation
  const resendSTKMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      try {
        const response = await fetch("/api/payments/mpesa/resend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to resend STK Push");
        }
        
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout. Please check your connection and try again.');
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Payment request resent!",
        description: data.customerMessage || "Please check your phone and complete the payment.",
      });
      setPaymentPollingEnabled(true);
      setPaymentStartTime(Date.now());
      setPaymentTimeoutReached(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to resend payment",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    },
  });

  // Cancel payment mutation
  const cancelPaymentMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch("/api/payments/mpesa/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to cancel payment");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment cancelled",
        description: "You can choose a different payment method or try again later.",
      });
      setIsWaitingForPayment(false);
      setPaymentPollingEnabled(false);
      setPaymentStartTime(null);
      setPaymentTimeoutReached(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to cancel payment",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const initiateMpesaPaymentMutation = useMutation({
    mutationFn: async (data: { orderId: string; phone: string }) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      try {
        const response = await fetch("/api/payments/mpesa/initiate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to initiate Mpesa payment");
        }
        
        return response.json();
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          throw new Error('Request timeout. Please check your connection and try again.');
        }
        throw error;
      }
    },
    onSuccess: (data) => {
      toast({
        title: "Payment request sent!",
        description: data.customerMessage || "Please complete the payment on your phone.",
      });
      setIsWaitingForPayment(true);
      setPaymentPollingEnabled(true);
      setPaymentStartTime(Date.now());
      setPaymentTimeoutReached(false);
    },
    onError: (error: any) => {
      const errorMessage = error.message || "Failed to initiate payment. Please try again.";
      
      // Provide more specific error messages
      let title = "Payment failed";
      let description = errorMessage;
      
      if (errorMessage.includes('phone number')) {
        title = "Invalid phone number";
        description = "Please enter a valid Kenyan mobile number (e.g., 0712345678).";
      } else if (errorMessage.includes('insufficient funds')) {
        title = "Insufficient funds";
        description = "Please ensure you have sufficient funds in your M-Pesa account.";
      } else if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        title = "Connection error";
        description = "Please check your internet connection and try again.";
      } else if (errorMessage.includes('duplicate')) {
        title = "Duplicate request";
        description = "Please wait a moment before trying again.";
      } else if (errorMessage.includes('not configured')) {
        title = "Service unavailable";
        description = "M-Pesa payment is temporarily unavailable. Please contact support.";
      }
      
      toast({
        title,
        description,
        variant: "destructive",
      });
      
      setIsWaitingForPayment(false);
      setPaymentPollingEnabled(false);
      setPaymentStartTime(null);
    },
  });

  // Create Stripe payment intent
  const createPaymentIntentMutation = useMutation({
    mutationFn: async (data: { orderId: string; amount: number }) => {
      const response = await fetch("/api/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: data.amount }),
      });
      if (!response.ok) {
        throw new Error("Failed to create payment intent");
      }
      return response.json();
    },
    onSuccess: (data) => {
      setStripeClientSecret(data.clientSecret);
      setShowStripePayment(true);
      toast({
        title: "Payment ready",
        description: "Please complete your payment below.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Payment setup failed",
        description: error.message || "Unable to setup payment. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Stripe payment confirmation mutation
  const confirmStripePaymentMutation = useMutation({
    mutationFn: async (data: { orderId: string; paymentIntentId: string }) => {
      const response = await fetch("/api/payments/stripe/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to confirm payment");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Payment successful!",
        description: `Your order #${data.orderId} has been paid and confirmed. A receipt has been sent to your email.`,
      });
      clearCart();
      setShowStripePayment(false);
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    },
    onError: (error: any) => {
      toast({
        title: "Payment confirmation failed",
        description: error.message || "Unable to confirm payment. Please contact support.",
        variant: "destructive",
      });
      setShowStripePayment(false);
    },
  });

  // Handle successful Stripe payment
  const handleStripePaymentSuccess = (paymentIntentId: string) => {
    if (currentOrderId) {
      confirmStripePaymentMutation.mutate({
        orderId: currentOrderId,
        paymentIntentId
      });
    } else {
      toast({
        title: "Error",
        description: "Order ID not found. Please contact support.",
        variant: "destructive",
      });
    }
  };

  // Handle Stripe payment error  
  const handleStripePaymentError = (error: string) => {
    toast({
      title: "Payment failed",
      description: error,
      variant: "destructive",
    });
    setShowStripePayment(false);
  };

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
      setCurrentOrderId(data.id);
      
      if (formData.paymentMethod === "mpesa") {
        // For Mpesa, initiate payment immediately after order creation
        const phoneToUse = formData.mpesaPhone || formData.phone;
        initiateMpesaPaymentMutation.mutate({
          orderId: data.id,
          phone: phoneToUse,
        });
      } else if (formData.paymentMethod === "stripe") {
        // For Stripe, create payment intent
        createPaymentIntentMutation.mutate({
          orderId: data.id,
          amount: total
        });
      } else {
        // For other payment methods
        toast({
          title: "Order placed successfully!",
          description: `Your order #${data.id} has been received. We'll contact you soon.`,
        });
        clearCart();
        setLocation("/");
      }
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

    // Additional validation for Mpesa
    if (formData.paymentMethod === "mpesa") {
      const phoneToValidate = formData.mpesaPhone || formData.phone;
      
      // More comprehensive phone validation
      if (!phoneToValidate.trim()) {
        toast({
          title: "Phone number required",
          description: "Please enter your M-Pesa phone number.",
          variant: "destructive",
        });
        return;
      }
      
      const cleaned = phoneToValidate.replace(/\D/g, '');
   
      const phonePattern = /^(254(7|1)[0-9]{8}|0(7|1)[0-9]{8})$/;
      
      if (!phonePattern.test(cleaned)) {
        toast({
          title: `Invalid phone number ${phonePattern.test(cleaned)}`,
          description: "Please enter a valid Kenyan mobile number (Safaricom, Airtel, or Telkom).",
          variant: "destructive",
        });
        return;
      }

      // Check if it's a valid network prefix
      let normalizedForValidation = cleaned;
      if (cleaned.startsWith('254')) {
        normalizedForValidation = cleaned;
      } else if (cleaned.startsWith('0')) {
        normalizedForValidation = '254' + cleaned.substring(1);
      } else {
        normalizedForValidation = '254' + cleaned;
      }
      
      const prefix = normalizedForValidation.substring(3, 5);
      const validPrefixes = ['70', '71', '72', '79', '74', '75', '76', '77', '78', '10', '11'];
      
      if (!validPrefixes.includes(prefix)) {
        toast({
          title: "Invalid network",
          description: "Please enter a Safaricom, Airtel, or Telkom number.",
          variant: "destructive",
        });
        return;
      }
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
                <CardContent className="space-y-4">
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
                      <Label htmlFor="mpesa" className="flex items-center">
                        <Smartphone className="h-4 w-4 mr-1" />
                        M-Pesa
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {/* Mpesa Phone Number Input */}
                  {formData.paymentMethod === "mpesa" && (
                    <div className="mt-4">
                      <Label htmlFor="mpesaPhone">M-Pesa Phone Number</Label>
                      <Input
                        id="mpesaPhone"
                        type="tel"
                        value={formData.mpesaPhone}
                        onChange={(e) => handleInputChange("mpesaPhone", e.target.value)}
                        placeholder={formData.phone || "0712345678"}
                        className="mt-1"
                        data-testid="input-mpesa-phone"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Leave empty to use contact phone number above
                      </p>
                    </div>
                  )}
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
                    disabled={createOrderMutation.isPending || initiateMpesaPaymentMutation.isPending || isWaitingForPayment}
                    data-testid="button-place-order"
                  >
                    {(createOrderMutation.isPending || initiateMpesaPaymentMutation.isPending) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {formData.paymentMethod === "mpesa" ? "Initiating Payment..." : "Placing Order..."}
                      </>
                    ) : isWaitingForPayment ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Waiting for Payment...
                      </>
                    ) : (
                      `Place Order - KSh ${total.toLocaleString()}`
                    )}
                  </Button>

                  {formData.paymentMethod === "mpesa" && !isWaitingForPayment && (
                    <div className="text-sm text-muted-foreground text-center mt-2">
                      <p className="flex items-center justify-center">
                        <Smartphone className="h-4 w-4 mr-1" />
                        You'll receive a payment prompt on your phone
                      </p>
                    </div>
                  )}

                  {isWaitingForPayment && currentOrderId && (
                    <div className="text-sm text-center mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        Complete payment on your phone
                      </p>
                      <p className="text-blue-700 dark:text-blue-300 mt-1">
                        Check your phone for M-Pesa payment prompt
                      </p>
                      
                      {paymentTimeoutReached && (
                        <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded">
                          <p className="text-yellow-800 dark:text-yellow-200 text-xs">
                            Payment is taking longer than expected. You can resend the STK push or cancel.
                          </p>
                        </div>
                      )}
                      
                      <div className="mt-3 flex justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendSTKMutation.mutate(currentOrderId)}
                          disabled={resendSTKMutation.isPending}
                          data-testid="button-resend-stk"
                        >
                          {resendSTKMutation.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Resending...
                            </>
                          ) : (
                            <>
                              <Smartphone className="h-3 w-3 mr-1" />
                              Resend STK
                            </>
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => cancelPaymentMutation.mutate(currentOrderId)}
                          disabled={cancelPaymentMutation.isPending}
                          data-testid="button-cancel-payment"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {paymentTimeoutReached && (
                    <div className="text-sm text-center mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <p className="font-medium text-amber-900 dark:text-amber-100">
                        Payment timeout
                      </p>
                      <p className="text-amber-700 dark:text-amber-300 mt-1">
                        If payment was deducted, it will be processed automatically
                      </p>
                      <div className="mt-2 flex justify-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (currentOrderId) {
                              const phoneToUse = formData.mpesaPhone || formData.phone;
                              initiateMpesaPaymentMutation.mutate({
                                orderId: currentOrderId,
                                phone: phoneToUse,
                              });
                            }
                          }}
                          disabled={initiateMpesaPaymentMutation.isPending}
                          data-testid="button-retry-payment"
                        >
                          {initiateMpesaPaymentMutation.isPending ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              Retrying...
                            </>
                          ) : (
                            "Retry Payment"
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground pt-4">
                    <p>• Contact: 0792246027</p>
                    <p>• We'll call to confirm your order</p>
                    {formData.paymentMethod === "stripe" && <p>• Payment on delivery available</p>}
                    {formData.paymentMethod === "mpesa" && <p>• Instant M-Pesa payment</p>}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>

        {/* Stripe Payment Form */}
        {showStripePayment && stripeClientSecret && stripePromise && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Complete Payment</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Order #{currentOrderId} • Secure payment with Stripe
                </p>
              </CardHeader>
              <CardContent>
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret: stripeClientSecret,
                    appearance: {
                      theme: 'stripe'
                    }
                  }}
                >
                  <StripePaymentForm
                    clientSecret={stripeClientSecret}
                    onSuccess={handleStripePaymentSuccess}
                    onError={handleStripePaymentError}
                    orderTotal={total}
                  />
                </Elements>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Show error if Stripe is not available */}
        {showStripePayment && !stripePromise && (
          <div className="mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Payment Configuration Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Stripe payment is not available. Please contact support or try Mpesa payment.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}