import { ShoppingCart, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import ThemeToggle from "./ThemeToggle";

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { state } = useCart();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    console.log('Mobile menu toggled:', !isMenuOpen);
  };

  return (
    <header className="bg-background border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-2" data-testid="link-home">
              <div className="text-2xl font-serif font-bold text-primary">
                KARY
              </div>
              <div className="text-sm font-arabic text-muted-foreground">
                عطور
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/" data-testid="link-home-nav">
              <Button variant="ghost" className="text-foreground hover-elevate">
                Home
              </Button>
            </Link>
            <Link href="/shop" data-testid="link-shop">
              <Button variant="ghost" className="text-foreground hover-elevate">
                Shop
              </Button>
            </Link>
            <Link href="/contact" data-testid="link-contact">
              <Button variant="ghost" className="text-foreground hover-elevate">
                Contact
              </Button>
            </Link>
          </nav>

          {/* Theme Toggle, Cart and Mobile Menu */}
          <div className="flex items-center space-x-2">
            <ThemeToggle />
            
            <Link href="/cart" data-testid="link-cart">
              <Button variant="ghost" size="icon" className="relative hover-elevate">
                <ShoppingCart className="h-5 w-5" />
                {state.itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {state.itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden hover-elevate"
              onClick={toggleMenu}
              data-testid="button-mobile-menu"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link href="/" data-testid="link-home-mobile">
                <Button variant="ghost" className="w-full justify-start hover-elevate" onClick={() => setIsMenuOpen(false)}>
                  Home
                </Button>
              </Link>
              <Link href="/shop" data-testid="link-shop-mobile">
                <Button variant="ghost" className="w-full justify-start hover-elevate" onClick={() => setIsMenuOpen(false)}>
                  Shop
                </Button>
              </Link>
              <Link href="/contact" data-testid="link-contact-mobile">
                <Button variant="ghost" className="w-full justify-start hover-elevate" onClick={() => setIsMenuOpen(false)}>
                  Contact
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}