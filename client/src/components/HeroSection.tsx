import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import heroBannerUrl from "@assets/generated_images/Perfume_website_hero_banner_e2d0daaf.png";

export default function HeroSection() {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBannerUrl})` }}
      />
      
      {/* Dark Overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-black/20" />
      
      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-serif font-bold text-white mb-4">
          KARY SCENTS
        </h1>
        
        <p className="text-lg md:text-xl text-white/90 mb-8 max-w-2xl mx-auto">
          Discover the finest collection of authentic fragrances and luxury scents
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/shop">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8 py-3"
              data-testid="button-shop-now"
            >
              Shop Collection
            </Button>
          </Link>
          
          <Button 
            variant="outline" 
            size="lg" 
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm px-8 py-3"
            data-testid="button-learn-more"
            onClick={() => console.log('Learn more clicked')}
          >
            Learn More
          </Button>
        </div>
        
        {/* Key Features */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6 text-white/80">
          <div className="text-center">
            <div className="font-semibold">Fast Delivery</div>
            <div className="text-sm">Nairobi CBD - Ksh 200</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">Authentic Scents</div>
            <div className="text-sm">Premium Fragrances</div>
          </div>
          <div className="text-center">
            <div className="font-semibold">Easy Shopping</div>
            <div className="text-sm">No Account Required</div>
          </div>
        </div>
      </div>
    </section>
  );
}