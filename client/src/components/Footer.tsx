import { Phone, MapPin, Clock } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-muted mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="text-2xl font-serif font-bold text-primary">
                Kary Perfumes
              </div>
            </div>
            <p className="text-muted-foreground">
              Premium fragrances and luxury scents. Authentic quality, delivered across Kenya.
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Contact Us</h3>
            
            <div className="flex items-center space-x-3 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span data-testid="text-phone">0792246027</span>
            </div>
            
            <div className="flex items-center space-x-3 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>Kenya</span>
            </div>
            
            <div className="flex items-center space-x-3 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Mon-Sat: 9AM-7PM</span>
            </div>
          </div>

          {/* Delivery Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Delivery</h3>
            
            <div className="space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Nairobi CBD</span>
                <span className="font-medium">Ksh 200</span>
              </div>
              <div className="flex justify-between">
                <span>Other Locations</span>
                <span className="font-medium">Ksh 300</span>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Fast delivery • No account required • Secure payments
            </div>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; 2025 Kary Perfumes. Premium Fragrances in Kenya.</p>
        </div>
      </div>
    </footer>
  );
}