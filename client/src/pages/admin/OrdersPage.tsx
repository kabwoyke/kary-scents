import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  ArrowLeft,
  ShoppingCart,
  Package,
  Truck,
  CheckCircle,
  Clock,
  User,
  MapPin,
  Phone,
  Mail
} from "lucide-react";

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  deliveryLocation: string;
  deliveryCharge: number;
  subtotal: number;
  total: number;
  status: string;
  stripePaymentIntentId?: string;
  createdAt: string;
  updatedAt: string;
}

const statusConfig = {
  pending: { icon: Clock, color: "bg-yellow-500", label: "Pending" },
  processing: { icon: Package, color: "bg-blue-500", label: "Processing" },
  shipped: { icon: Truck, color: "bg-purple-500", label: "Shipped" },
  delivered: { icon: CheckCircle, color: "bg-green-500", label: "Delivered" },
};

export default function AdminOrdersPage() {
  const [, setLocation] = useLocation();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const { toast } = useToast();

  // Fetch orders based on status filter
  const { data: ordersData, isLoading: ordersLoading, error } = useQuery({
    queryKey: ["/api/admin/orders", selectedStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== "all") {
        params.append("status", selectedStatus);
      }
      params.append("limit", "100"); // Get more orders for admin
      
      const response = await fetch(`/api/admin/orders?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }
      return response.json();
    },
  });

  // Update order status mutation
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/admin/orders/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to update order status");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrderStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const getStatusIcon = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    if (!config) return Clock;
    return config.icon;
  };

  const getStatusColor = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    return config?.color || "bg-gray-500";
  };

  const getStatusLabel = (status: string) => {
    const config = statusConfig[status as keyof typeof statusConfig];
    return config?.label || status;
  };

  const orders = ordersData?.orders || [];
  const totalOrders = ordersData?.total || 0;

  const ordersByStatus = {
    all: orders,
    pending: orders.filter((o: Order) => o.status === "pending"),
    processing: orders.filter((o: Order) => o.status === "processing"),
    shipped: orders.filter((o: Order) => o.status === "shipped"),
    delivered: orders.filter((o: Order) => o.status === "delivered"),
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access admin orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/admin/login")}
              className="w-full"
            >
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                onClick={() => setLocation("/admin/dashboard")}
                data-testid="button-back-to-dashboard"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-serif font-bold text-primary">
                Orders Management
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Tabs */}
        <Tabs value={selectedStatus} onValueChange={setSelectedStatus} className="mb-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all" data-testid="tab-all-orders">
              All Orders ({totalOrders})
            </TabsTrigger>
            <TabsTrigger value="pending" data-testid="tab-pending-orders">
              Pending ({ordersByStatus.pending.length})
            </TabsTrigger>
            <TabsTrigger value="processing" data-testid="tab-processing-orders">
              Processing ({ordersByStatus.processing.length})
            </TabsTrigger>
            <TabsTrigger value="shipped" data-testid="tab-shipped-orders">
              Shipped ({ordersByStatus.shipped.length})
            </TabsTrigger>
            <TabsTrigger value="delivered" data-testid="tab-delivered-orders">
              Delivered ({ordersByStatus.delivered.length})
            </TabsTrigger>
          </TabsList>

          {Object.entries(ordersByStatus).map(([status, statusOrders]) => (
            <TabsContent key={status} value={status} className="mt-6">
              {ordersLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-6 w-20" />
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Skeleton className="h-3 w-full mb-2" />
                        <Skeleton className="h-3 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : statusOrders.length === 0 ? (
                <Card className="text-center py-12">
                  <CardHeader>
                    <ShoppingCart className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <CardTitle>No {status === "all" ? "" : getStatusLabel(status)} Orders</CardTitle>
                    <CardDescription>
                      {status === "all" 
                        ? "No orders have been placed yet" 
                        : `No orders with ${getStatusLabel(status).toLowerCase()} status`}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-4">
                  {statusOrders.map((order: Order) => {
                    const StatusIcon = getStatusIcon(order.status);
                    return (
                      <Card key={order.id} className="hover-elevate">
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <CardTitle className="text-lg" data-testid={`text-order-id-${order.id}`}>
                                Order #{order.id.slice(-8).toUpperCase()}
                              </CardTitle>
                              <CardDescription data-testid={`text-order-date-${order.id}`}>
                                {new Date(order.createdAt).toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </CardDescription>
                            </div>
                            <div className="flex items-center space-x-4">
                              <Badge className={`${getStatusColor(order.status)} text-white`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {getStatusLabel(order.status)}
                              </Badge>
                              <Select
                                value={order.status}
                                onValueChange={(value) => handleStatusChange(order.id, value)}
                                disabled={updateOrderStatusMutation.isPending}
                              >
                                <SelectTrigger className="w-32" data-testid={`select-status-${order.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="processing">Processing</SelectItem>
                                  <SelectItem value="shipped">Shipped</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Customer Info */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm text-muted-foreground">CUSTOMER DETAILS</h4>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <User className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm" data-testid={`text-customer-name-${order.id}`}>
                                    {order.customerName}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Phone className="w-4 h-4 text-muted-foreground" />
                                  <span className="text-sm" data-testid={`text-customer-phone-${order.id}`}>
                                    {order.customerPhone}
                                  </span>
                                </div>
                                {order.customerEmail && (
                                  <div className="flex items-center space-x-2">
                                    <Mail className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm" data-testid={`text-customer-email-${order.id}`}>
                                      {order.customerEmail}
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-start space-x-2">
                                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                                  <div className="text-sm">
                                    <div data-testid={`text-delivery-address-${order.id}`}>
                                      {order.deliveryAddress}
                                    </div>
                                    <div className="text-muted-foreground" data-testid={`text-delivery-location-${order.id}`}>
                                      {order.deliveryLocation === "nairobi-cbd" ? "Nairobi CBD" : "Other Location"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Order Summary */}
                            <div className="space-y-3">
                              <h4 className="font-medium text-sm text-muted-foreground">ORDER SUMMARY</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span>Subtotal:</span>
                                  <span data-testid={`text-order-subtotal-${order.id}`}>
                                    KSh {order.subtotal.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span>Delivery:</span>
                                  <span data-testid={`text-order-delivery-${order.id}`}>
                                    KSh {order.deliveryCharge.toLocaleString()}
                                  </span>
                                </div>
                                <div className="flex justify-between font-medium border-t pt-2">
                                  <span>Total:</span>
                                  <span data-testid={`text-order-total-${order.id}`}>
                                    KSh {order.total.toLocaleString()}
                                  </span>
                                </div>
                                {order.stripePaymentIntentId && (
                                  <div className="text-xs text-muted-foreground pt-1">
                                    Payment ID: {order.stripePaymentIntentId.slice(-8)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}