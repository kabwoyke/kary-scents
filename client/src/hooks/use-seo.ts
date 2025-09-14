import { useEffect } from 'react';

export interface SEOData {
  title: string;
  description: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  canonical?: string;
  structuredData?: object;
}

const DEFAULT_SEO: SEOData = {
  title: "Kary Perfumes - Premium Arabic Fragrances & Luxury Scents | Kenya",
  description: "Discover authentic Arabic perfumes and luxury fragrances at Kary Perfumes. Premium scents with fast delivery across Kenya. Nairobi CBD delivery from KSh 200. Call 0792246027.",
  keywords: "perfumes Kenya, Arabic fragrances, luxury scents, Kary Perfumes, Arabic perfumes Nairobi, premium fragrances Kenya, authentic perfumes, luxury scents delivery",
  ogImage: "/api/images/generated_images/Perfume_website_hero_banner_e2d0daaf.png",
  canonical: "https://karyperfumes.com"
};

export function useSEO(seoData: Partial<SEOData>) {
  useEffect(() => {
    const seo = { ...DEFAULT_SEO, ...seoData };
    
    // Update document title
    document.title = seo.title;
    
    // Helper function to update or create meta tag
    const updateMetaTag = (name: string, content: string, property: boolean = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        if (property) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };
    
    // Update basic meta tags
    updateMetaTag('description', seo.description);
    if (seo.keywords) {
      updateMetaTag('keywords', seo.keywords);
    }
    
    // Update Open Graph tags
    updateMetaTag('og:title', seo.ogTitle || seo.title, true);
    updateMetaTag('og:description', seo.ogDescription || seo.description, true);
    updateMetaTag('og:url', seo.canonical || window.location.href, true);
    
    if (seo.ogImage) {
      const baseUrl = window.location.origin;
      const absoluteImageUrl = seo.ogImage.startsWith('http') ? seo.ogImage : `${baseUrl}${seo.ogImage}`;
      updateMetaTag('og:image', absoluteImageUrl, true);
      updateMetaTag('og:image:width', '1200', true);
      updateMetaTag('og:image:height', '630', true);
      updateMetaTag('og:image:alt', `${seo.ogTitle || seo.title} - Premium Arabic perfumes and luxury fragrances`, true);
    }
    
    // Update Twitter Card tags
    updateMetaTag('twitter:title', seo.twitterTitle || seo.title);
    updateMetaTag('twitter:description', seo.twitterDescription || seo.description);
    updateMetaTag('twitter:site', '@karyperfumes');
    
    if (seo.ogImage) {
      const baseUrl = window.location.origin;
      const absoluteImageUrl = seo.ogImage.startsWith('http') ? seo.ogImage : `${baseUrl}${seo.ogImage}`;
      updateMetaTag('twitter:image', absoluteImageUrl);
      updateMetaTag('twitter:image:alt', `${seo.twitterTitle || seo.title} - Premium Arabic perfumes and luxury fragrances`);
    }
    
    // Update canonical URL
    let canonicalElement = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalElement) {
      canonicalElement = document.createElement('link');
      canonicalElement.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute('href', seo.canonical || window.location.href);
    
    // Add structured data if provided
    if (seo.structuredData) {
      // Remove existing structured data for this page
      const existingScript = document.querySelector('script[data-page-structured-data]');
      if (existingScript) {
        existingScript.remove();
      }
      
      // Add new structured data
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-page-structured-data', 'true');
      script.textContent = JSON.stringify(seo.structuredData);
      document.head.appendChild(script);
    }
    
  }, [seoData]);
}

// Predefined SEO configurations for common pages
export const SEO_CONFIGS = {
  home: {
    title: "Kary Perfumes - Premium Arabic Fragrances & Luxury Scents | Kenya",
    description: "Discover authentic Arabic perfumes and luxury fragrances at Kary Perfumes. Premium scents with fast delivery across Kenya. Nairobi CBD delivery from KSh 200.",
    keywords: "perfumes Kenya, Arabic fragrances, luxury scents, Kary Perfumes, authentic perfumes, premium fragrances Kenya",
    canonical: "https://karyperfumes.com"
  },
  
  shop: {
    title: "Shop Luxury Perfumes - Authentic Arabic Fragrances | Kary Perfumes Kenya",
    description: "Browse our complete collection of premium Arabic perfumes and luxury fragrances. Authentic scents with fast Kenya-wide delivery. Shop now at Kary Perfumes.",
    keywords: "buy perfumes Kenya, Arabic perfumes online, luxury fragrances shop, premium scents Kenya, perfume collection",
    canonical: "https://karyperfumes.com/shop"
  },
  
  contact: {
    title: "Contact Us - Kary Perfumes | Premium Fragrance Store Kenya",
    description: "Get in touch with Kary Perfumes for inquiries about our premium Arabic fragrances. Call 0792246027 or WhatsApp for fast service across Kenya.",
    keywords: "contact Kary Perfumes, perfume store Kenya, Arabic fragrance inquiry, luxury perfume contact",
    canonical: "https://karyperfumes.com/contact"
  },
  
  cart: {
    title: "Shopping Cart - Kary Perfumes | Luxury Perfume Shopping Kenya",
    description: "Review your selected premium Arabic perfumes and luxury fragrances. Fast delivery across Kenya from Kary Perfumes. Complete your perfume purchase.",
    keywords: "perfume cart, luxury fragrance shopping, Arabic perfume checkout, premium scents purchase",
    canonical: "https://karyperfumes.com/cart"
  },
  
  checkout: {
    title: "Checkout - Complete Your Perfume Purchase | Kary Perfumes Kenya",
    description: "Complete your luxury perfume purchase with secure payment options. Fast delivery across Kenya. Premium Arabic fragrances from Kary Perfumes.",
    keywords: "perfume checkout, luxury fragrance payment, Arabic perfume purchase, premium scents buy",
    canonical: "https://karyperfumes.com/checkout"
  },
  
  admin: {
    title: "Admin Dashboard - Kary Perfumes Management",
    description: "Kary Perfumes admin dashboard for managing products, orders, and customer reviews.",
    canonical: "https://karyperfumes.com/admin/dashboard"
  }
};

// Helper function to generate product-specific SEO
export function getProductSEO(productName: string, productId: string, productDescription?: string): SEOData {
  return {
    title: `${productName} - Premium Arabic Perfume | Kary Perfumes Kenya`,
    description: productDescription 
      ? `${productDescription.substring(0, 120)}... Premium Arabic perfume from Kary Perfumes with fast Kenya delivery.`
      : `Discover ${productName}, a premium Arabic perfume from Kary Perfumes. Authentic luxury fragrance with fast delivery across Kenya.`,
    keywords: `${productName}, Arabic perfume, luxury fragrance, premium scent, Kary Perfumes Kenya`,
    canonical: `https://karyperfumes.com/product/${productId}`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": productName,
      "description": productDescription || `Premium Arabic perfume ${productName} from Kary Perfumes`,
      "brand": {
        "@type": "Brand",
        "name": "Kary Perfumes"
      },
      "category": "Beauty & Personal Care > Fragrances",
      "url": `https://karyperfumes.com/product/${productId}`,
      "offers": {
        "@type": "AggregateOffer",
        "priceCurrency": "KES",
        "availability": "https://schema.org/InStock",
        "seller": {
          "@type": "Organization",
          "name": "Kary Perfumes"
        }
      }
    }
  };
}