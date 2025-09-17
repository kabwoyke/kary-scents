import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useSEO, SEO_CONFIGS } from "@/hooks/use-seo";
import { 
  Package, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp, 
  LogOut,
  Settings,
  Users,
  BarChart3,
  MessageSquare,
  CreditCard,
  FolderOpen
} from "lucide-react";

interface AdminStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  recentOrdersCount: number;
}

export default function AdminDashboardPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Set unique SEO for admin dashboard
  useSEO(SEO_CONFIGS.admin);

  // Fetch admin stats
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stats", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch stats");
      }
      return response.json();
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to logout");
      }
      return response.json();
    },
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
      toast({
        title: "Success",
        description: "Successfully logged out",
      });
      setLocation("/admin/login");
    },
    onError: () => {
      // Even if logout fails, redirect to login
      setLocation("/admin/login");
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  if (statsError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Authentication Required</CardTitle>
            <CardDescription>
              Please log in to access the admin dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation("/admin/login")}
              className="w-full"
              data-testid="button-go-to-login"
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
              <h1 className="text-2xl font-serif font-bold text-primary">
                Kary Perfumes Admin
              </h1>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              disabled={logoutMutation.isPending}
              data-testid="button-admin-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {logoutMutation.isPending ? "Logging out..." : "Logout"}
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
          <p className="text-muted-foreground">
            Welcome to your admin dashboard. Manage your perfume store and track performance.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-products">
                    {stats?.totalProducts || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Products in catalog
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-orders">
                    {stats?.totalOrders || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All time orders
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-total-revenue">
                    KSh {Number(stats?.totalRevenue || 0).toFixed(2)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    All time revenue
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recent Orders</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-2xl font-bold" data-testid="text-recent-orders">
                    {stats?.recentOrdersCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last 7 days
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/admin/products")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Package className="w-6 h-6 text-primary" />
                <CardTitle>Manage Products</CardTitle>
              </div>
              <CardDescription>
                Add, edit, or remove products from your catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" data-testid="button-manage-products">
                Go to Products
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/admin/categories")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <FolderOpen className="w-6 h-6 text-primary" />
                <CardTitle>Manage Categories</CardTitle>
              </div>
              <CardDescription>
                Organize products into categories and subcategories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" data-testid="button-manage-categories">
                Go to Categories
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/admin/orders")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-6 h-6 text-primary" />
                <CardTitle>Manage Orders</CardTitle>
              </div>
              <CardDescription>
                View and update order statuses and details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" data-testid="button-manage-orders">
                Go to Orders
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/admin/reviews")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <MessageSquare className="w-6 h-6 text-primary" />
                <CardTitle>Manage Reviews</CardTitle>
              </div>
              <CardDescription>
                Moderate customer reviews and maintain quality
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" data-testid="button-manage-reviews">
                Go to Reviews
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/admin/payments")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <CreditCard className="w-6 h-6 text-primary" />
                <CardTitle>Manage Payments</CardTitle>
              </div>
              <CardDescription>
                View payment analytics and transaction history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" data-testid="button-manage-payments">
                Go to Payments
              </Button>
            </CardContent>
          </Card>

          <Card className="hover-elevate cursor-pointer" onClick={() => setLocation("/")}>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-6 h-6 text-primary" />
                <CardTitle>View Store</CardTitle>
              </div>
              <CardDescription>
                Visit your public store and see how customers see it
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" data-testid="button-view-store">
                Visit Store
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}