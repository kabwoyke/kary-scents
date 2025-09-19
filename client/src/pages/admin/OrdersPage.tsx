import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Mail,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  XCircle
} from "lucide-react";

interface Order {
  id: string;
  orderNumber:string;
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
  cancelled: { icon: XCircle, color: "bg-red-500", label: "Cancelled" },
};

const orderSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
  customerPhone: z.string().min(1, "Phone number is required"),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  deliveryLocation: z.enum(["nairobi-cbd", "nairobi-other"], {
    required_error: "Please select a delivery location",
  }),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
});

type OrderFormData = z.infer<typeof orderSchema>;

export default function AdminOrdersPage() {
  const [, setLocation] = useLocation();
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(20);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      deliveryAddress: "",
      deliveryLocation: "nairobi-cbd",
      status: "pending",
    },
  });

  const offset = (currentPage - 1) * limit;

  // Fetch orders with search and pagination
  const { data: ordersData, isLoading: ordersLoading, error } = useQuery({
    queryKey: ["/api/admin/orders", selectedStatus, searchQuery, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      
      if (selectedStatus !== "all") {
        params.append("status", selectedStatus);
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      
      const response = await fetch(`/api/admin/orders?${params}`, {
        credentials: "include",
      });
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

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: OrderFormData) => {
      const orderData = {
        order: {
          customerName: data.customerName,
          customerEmail: data.customerEmail || undefined,
          customerPhone: data.customerPhone,
          deliveryAddress: data.deliveryAddress,
          deliveryLocation: data.deliveryLocation,
          deliveryCharge: data.deliveryLocation === "nairobi-cbd" ? 200 : 300,
          subtotal: 0, // Admin orders start with 0 subtotal
          total: data.deliveryLocation === "nairobi-cbd" ? 200 : 300,
          paymentMethod: "manual" as const,
          status: data.status,
        },
        items: [], // Admin orders can start with no items
      };
      
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to create order");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Order created successfully",
      });
      handleCloseCreateDialog();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create order",
        variant: "destructive",
      });
    },
  });

  // Delete order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete order");
      }
      return response.status === 204 ? {} : response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Success",
        description: "Order deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    },
  });

  const handleOrderStatusChange = (orderId: string, newStatus: string) => {
    updateOrderStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handleSubmit = (data: OrderFormData) => {
    createOrderMutation.mutate(data);
  };

  const handleDelete = (order: Order) => {
    if (confirm(`Are you sure you want to delete order #${order.id}?`)) {
      deleteOrderMutation.mutate(order.id);
    }
  };

  const handleCloseCreateDialog = () => {
    setIsCreateDialogOpen(false);
    form.reset();
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
  const totalPages = Math.ceil(totalOrders / limit);

  // Reset to first page when search query or status changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  };

  const ordersByStatus = {
    all: orders,
    pending: orders.filter((o: Order) => o.status === "pending"),
    processing: orders.filter((o: Order) => o.status === "processing"),
    shipped: orders.filter((o: Order) => o.status === "shipped"),
    delivered: orders.filter((o: Order) => o.status === "delivered"),
    cancelled: orders.filter((o: Order) => o.status === "cancelled"),
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
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-order">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Order</DialogTitle>
                  <DialogDescription>
                    Create a manual order entry for the admin dashboard
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Customer Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Enter customer name" 
                                data-testid="input-customer-name"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="customerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="0712345678" 
                                data-testid="input-customer-phone"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="customerEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (Optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="email"
                              placeholder="customer@example.com" 
                              data-testid="input-customer-email"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="deliveryAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Delivery Address</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Enter full delivery address" 
                              data-testid="input-delivery-address"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="deliveryLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Location</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-delivery-location">
                                  <SelectValue placeholder="Select delivery location" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="nairobi-cbd">Nairobi CBD (KSh 200)</SelectItem>
                                <SelectItem value="nairobi-other">Other Nairobi Areas (KSh 300)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Initial Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-order-status">
                                  <SelectValue placeholder="Select order status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end space-x-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCloseCreateDialog}
                        data-testid="button-cancel-order"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createOrderMutation.isPending}
                        data-testid="button-save-order"
                      >
                        {createOrderMutation.isPending ? "Creating..." : "Create Order"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Search & Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order ID, customer name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                    data-testid="input-order-search"
                  />
                </div>
              </div>
              <Select value={selectedStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full md:w-40" data-testid="select-order-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="shipped">Shipped</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Status Tabs */}
        <Tabs value={selectedStatus} onValueChange={handleStatusChange} className="mb-8">
          <TabsList className="grid w-full grid-cols-6">
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
            <TabsTrigger value="cancelled" data-testid="tab-cancelled-orders">
              Cancelled ({ordersByStatus.cancelled.length})
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
                                #{order.orderNumber}
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
                              <div className="flex items-center space-x-2">
                                <Select
                                  value={order.status}
                                  onValueChange={(value) => handleOrderStatusChange(order.id, value)}
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
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleDelete(order)}
                                  disabled={deleteOrderMutation.isPending}
                                  data-testid={`button-delete-order-${order.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
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
                                    KSh {Number(order.total).toFixed(2)}
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

                  {/* Pagination */}
                  {totalOrders > limit && (
                    <Card className="mt-6">
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">
                            Showing {offset + 1} to {Math.min(offset + limit, totalOrders)} of {totalOrders} orders
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                              disabled={currentPage === 1}
                              data-testid="button-previous-page"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Previous
                            </Button>
                            <div className="text-sm">
                              Page {currentPage} of {totalPages}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={currentPage === totalPages}
                              data-testid="button-next-page"
                            >
                              Next
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}