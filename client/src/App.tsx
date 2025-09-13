import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import HomePage from "@/pages/HomePage";
import ShopPage from "@/pages/ShopPage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import CartPage from "@/pages/CartPage";
import CheckoutPage from "@/pages/CheckoutPage";
import ContactPage from "@/pages/ContactPage";
import NotFound from "@/pages/NotFound";
import AdminLoginPage from "@/pages/admin/LoginPage";
import AdminDashboardPage from "@/pages/admin/DashboardPage";
import AdminProductsPage from "@/pages/admin/ProductsPage";
import AdminOrdersPage from "@/pages/admin/OrdersPage";
import AdminReviewsPage from "@/pages/admin/ReviewsPage";
import AdminPaymentsPage from "@/pages/admin/PaymentsPage";

function Router() {
  return (
    <Switch>
      {/* Admin Routes */}
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin/dashboard" component={AdminDashboardPage} />
      <Route path="/admin/products" component={AdminProductsPage} />
      <Route path="/admin/orders" component={AdminOrdersPage} />
      <Route path="/admin/reviews" component={AdminReviewsPage} />
      <Route path="/admin/payments" component={AdminPaymentsPage} />
      
      {/* Public Routes */}
      <Route path="/" component={HomePage} />
      <Route path="/shop" component={ShopPage} />
      <Route path="/product/:id" component={ProductDetailPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/contact" component={ContactPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CartProvider>
          <AppLayout />
          <Toaster />
        </CartProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const isAdminRoute = location.startsWith('/admin');
  
  if (isAdminRoute) {
    // Admin routes don't need Header/Footer - they have their own layouts
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Router />
      </div>
    );
  }
  
  // Regular routes get Header/Footer
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="flex-1">
        <Router />
      </main>
      <Footer />
    </div>
  );
}

export default App;
