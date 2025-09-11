import { Phone, MapPin, Clock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  const handleCall = () => {
    window.location.href = "tel:0792246027";
    console.log('Calling KARY PERFUMES');
  };

  const handleWhatsApp = () => {
    const message = encodeURIComponent("Hello, I'm interested in your perfume collection!");
    window.open(`https://wa.me/254792246027?text=${message}`, '_blank');
    console.log('Opening WhatsApp chat');
  };

  return (
    <div className="min-h-screen bg-background py-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
            Contact Us
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Get in touch with KARY PERFUMES for inquiries about our premium Arabic fragrances
          </p>
          <div className="text-base font-arabic text-muted-foreground mt-2">
            تواصل معنا لأفضل العطور العربية
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">KARY PERFUMES</h3>
                <p className="text-muted-foreground">
                  Premium Arabic Fragrances & Luxury Scents
                </p>
                <p className="font-arabic text-muted-foreground text-sm">
                  عطور عربية أصيلة وعطور فاخرة
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium" data-testid="text-phone-number">0792246027</p>
                    <p className="text-sm text-muted-foreground">Call or WhatsApp</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Kenya</p>
                    <p className="text-sm text-muted-foreground">Countrywide delivery</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-medium">Mon - Sat: 9:00 AM - 7:00 PM</p>
                    <p className="text-sm text-muted-foreground">Sunday: By appointment</p>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  We specialize in authentic Arabic fragrances and luxury scents. 
                  Contact us for product inquiries, custom orders, or any questions 
                  about our collection.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Actions */}
          <Card className="hover-elevate">
            <CardHeader>
              <CardTitle>Get in Touch</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Ready to explore our fragrance collection? Contact us now!
                </p>

                <div className="space-y-3">
                  <Button 
                    className="w-full hover-elevate" 
                    size="lg"
                    onClick={handleCall}
                    data-testid="button-call"
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    Call Now: 0792246027
                  </Button>

                  <Button 
                    variant="outline" 
                    className="w-full hover-elevate" 
                    size="lg"
                    onClick={handleWhatsApp}
                    data-testid="button-whatsapp"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    WhatsApp Chat
                  </Button>
                </div>
              </div>

              {/* Delivery Information */}
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-base">Delivery Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Nairobi CBD</span>
                    <span className="text-sm font-medium text-primary">Ksh 200</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Other Locations</span>
                    <span className="text-sm font-medium text-primary">Ksh 300</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Fast and reliable delivery across Kenya. No account registration required for purchase.
                  </p>
                </CardContent>
              </Card>

              <div className="text-center pt-4">
                <p className="text-sm font-arabic text-muted-foreground">
                  مرحباً بكم في كاري بيرفيومز
                </p>
                <p className="text-xs text-muted-foreground">
                  Welcome to KARY PERFUMES
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}