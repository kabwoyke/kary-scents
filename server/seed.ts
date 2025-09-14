import { storage } from "./storage";

async function seedProducts() {
  console.log("Seeding products...");
  
  // Check if products already exist
  const existingProducts = await storage.getAllProducts();
  if (existingProducts.products.length > 0) {
    console.log(`${existingProducts.products.length} products already exist, skipping seed.`);
    return;
  }

  // Create categories first
  const categories = [
    { name: "Arabic Fragrances", description: "Traditional Arabic and Middle Eastern perfumes" },
    { name: "Floral Scents", description: "Delicate floral fragrances with rose, jasmine, and other flowers" },
    { name: "Oriental", description: "Rich oriental scents with amber, spices, and exotic notes" },
    { name: "Premium Collection", description: "Exclusive high-end fragrances with rare ingredients" }
  ];

  const categoryMap = new Map<string, string>();
  
  for (const categoryData of categories) {
    // Check if category already exists
    let category = await storage.getCategoryByName(categoryData.name);
    if (!category) {
      // Create category if it doesn't exist
      category = await storage.createCategory(categoryData);
      console.log(`Created category: ${category.name}`);
    }
    categoryMap.set(categoryData.name, category.id);
  }

  const productsToSeed = [
    {
      name: "Oud Al Maktoub",
      description: "A luxurious blend of traditional oud and modern elegance, perfect for special occasions and evening wear. This exquisite fragrance combines the richness of aged oud with delicate floral notes.",
      price: 450000, // 4500 KSh in cents
      originalPrice: 550000, // 5500 KSh in cents
      image: "/api/images/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png",
      category: "Arabic Fragrances",
      isNew: true,
    },
    {
      name: "Rose Damascena",
      description: "Delicate Damascus rose with subtle woody undertones for everyday elegance. A timeless fragrance that captures the essence of blooming roses in Syrian gardens.",
      price: 320000, // 3200 KSh in cents
      image: "/api/images/generated_images/Premium_Arabic_perfume_bottle_17638015.png",
      category: "Floral Scents",
      isNew: false,
    },
    {
      name: "Amber Nights",
      description: "Warm amber and exotic spices for evening occasions and special moments. This oriental masterpiece evokes the mystery of Arabian nights with its deep, sensual notes.",
      price: 380000, // 3800 KSh in cents
      image: "/api/images/generated_images/Arabic_perfume_collection_display_7e73a28e.png",
      category: "Oriental",
      isNew: false,
    },
    {
      name: "Jasmine Royal",
      description: "Pure jasmine essence with hints of sandalwood for a royal experience. This sophisticated blend captures the intoxicating beauty of night-blooming jasmine.",
      price: 290000, // 2900 KSh in cents
      image: "/api/images/generated_images/Arabic_luxury_perfume_bottle_c29bda24.png",
      category: "Floral Scents",
      isNew: false,
    },
    {
      name: "Musk Al Tahara",
      description: "Traditional white musk, pure and clean for daily wear. A classic fragrance that embodies purity and freshness, perfect for everyday elegance.",
      price: 220000, // 2200 KSh in cents
      originalPrice: 280000, // 2800 KSh in cents
      image: "/api/images/generated_images/Premium_Arabic_perfume_bottle_17638015.png",
      category: "Arabic Fragrances",
      isNew: false,
    },
    {
      name: "Saffron Gold",
      description: "Exclusive saffron-infused fragrance with gold accents. A premium blend featuring the world's most precious spice, creating an aura of luxury and sophistication.",
      price: 520000, // 5200 KSh in cents
      image: "/api/images/generated_images/Arabic_perfume_collection_display_7e73a28e.png",
      category: "Premium Collection",
      isNew: true,
    },
  ];

  for (const product of productsToSeed) {
    try {
      const categoryId = categoryMap.get(product.category);
      if (!categoryId) {
        throw new Error(`Category ID not found for category: ${product.category}`);
      }
      
      const productData = {
        ...product,
        categoryId
      };
      
      await storage.createProduct(productData);
      console.log(`Created product: ${product.name}`);
    } catch (error) {
      console.error(`Error creating product ${product.name}:`, error);
    }
  }

  console.log("Product seeding completed!");
}

// Run seed if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedProducts().catch(console.error);
}

export { seedProducts };