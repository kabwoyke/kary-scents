import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertOrderSchema, adminLoginSchema, stripeConfirmPaymentSchema, insertReviewSchema, updateReviewStatusSchema, insertPaymentSchema, updatePaymentSchema, insertCategorySchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import crypto from "crypto";
import { mpesaService } from "./mpesa";
import { sendOrderReceiptEmail } from "./email";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

// Simple in-memory rate limiting for review submissions
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const reviewRateLimit = new Map<string, RateLimitEntry>();
const REVIEW_RATE_LIMIT_COUNT = 3; // max 3 reviews
const REVIEW_RATE_LIMIT_WINDOW = 10 * 60 * 1000; // 10 minutes in milliseconds

// Admin login rate limiting
const adminLoginRateLimit = new Map<string, RateLimitEntry>();
const ADMIN_LOGIN_RATE_LIMIT_COUNT = 5; // max 5 failed attempts
const ADMIN_LOGIN_RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes in milliseconds

// Clean up expired rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up review rate limits
  const reviewEntries = Array.from(reviewRateLimit.entries());
  for (const [ip, entry] of reviewEntries) {
    if (now > entry.resetTime) {
      reviewRateLimit.delete(ip);
    }
  }
  
  // Clean up admin login rate limits
  const adminEntries = Array.from(adminLoginRateLimit.entries());
  for (const [ip, entry] of adminEntries) {
    if (now > entry.resetTime) {
      adminLoginRateLimit.delete(ip);
    }
  }
}, Math.min(REVIEW_RATE_LIMIT_WINDOW, ADMIN_LOGIN_RATE_LIMIT_WINDOW)); // Clean at shortest interval

// Pagination utility function
interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

interface PaginationResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function validateAndParsePagination(req: Request): PaginationParams {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

function createPaginationResponse<T>(
  data: T[], 
  total: number, 
  page: number, 
  limit: number
): PaginationResponse<T> {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
}

// Rate limiting middleware for admin login
function checkAdminLoginRateLimit(req: Request, res: Response, next: NextFunction) {
  // Get client IP (handle proxy/cloudflare scenarios)
  const clientIP = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 
                   'unknown';
  
  const now = Date.now();
  const rateLimitEntry = adminLoginRateLimit.get(clientIP);
  
  if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
    // No entry exists or window has expired - allow the attempt but don't increment yet
    return next();
  }
  
  if (rateLimitEntry.count >= ADMIN_LOGIN_RATE_LIMIT_COUNT) {
    // Rate limit exceeded
    const resetInMinutes = Math.ceil((rateLimitEntry.resetTime - now) / (60 * 1000));
    console.warn(`Admin login attempt blocked for IP ${clientIP} - rate limit exceeded`);
    return res.status(429).json({
      error: "Too many login attempts",
      message: `Account temporarily locked. Please wait ${resetInMinutes} minute(s) before trying again.`,
      retryAfter: rateLimitEntry.resetTime
    });
  }
  
  // Allow attempt to proceed (will be incremented on failure)
  next();
}

// Helper function to record failed admin login attempt
function recordFailedAdminLogin(req: Request) {
  const clientIP = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 
                   'unknown';
  
  const now = Date.now();
  const rateLimitEntry = adminLoginRateLimit.get(clientIP);
  
  if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
    // Create new entry or reset expired entry
    adminLoginRateLimit.set(clientIP, {
      count: 1,
      resetTime: now + ADMIN_LOGIN_RATE_LIMIT_WINDOW
    });
  } else {
    // Increment existing entry
    rateLimitEntry.count += 1;
  }
  
  console.warn(`Failed admin login attempt from IP ${clientIP} (attempt ${rateLimitEntry?.count || 1}/${ADMIN_LOGIN_RATE_LIMIT_COUNT})`);
}

// Rate limiting middleware for reviews
function checkReviewRateLimit(req: Request, res: Response, next: NextFunction) {
  // Get client IP (handle proxy/cloudflare scenarios)
  const clientIP = req.headers['x-forwarded-for'] as string || 
                   req.headers['x-real-ip'] as string || 
                   req.socket.remoteAddress || 
                   'unknown';
  
  const now = Date.now();
  const rateLimitEntry = reviewRateLimit.get(clientIP);
  
  if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
    // No entry exists or window has expired, create new entry
    reviewRateLimit.set(clientIP, {
      count: 1,
      resetTime: now + REVIEW_RATE_LIMIT_WINDOW
    });
    return next();
  }
  
  if (rateLimitEntry.count >= REVIEW_RATE_LIMIT_COUNT) {
    // Rate limit exceeded
    const resetInMinutes = Math.ceil((rateLimitEntry.resetTime - now) / (60 * 1000));
    return res.status(429).json({
      error: "Too many review submissions",
      message: `You have exceeded the review submission limit. Please wait ${resetInMinutes} minute(s) before submitting another review.`,
      retryAfter: rateLimitEntry.resetTime
    });
  }
  
  // Increment counter and proceed
  rateLimitEntry.count += 1;
  next();
}

// Initialize Stripe - will handle missing key in payment endpoints
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Initialize Cloudinary
if (process.env.CLOUDINARY_URL) {
  try {
    // Parse CLOUDINARY_URL manually to ensure proper configuration
    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    console.log("Configuring Cloudinary with URL format...");
    
    // Extract credentials from URL format: cloudinary://api_key:api_secret@cloud_name
    const url = new URL(cloudinaryUrl);
    
    cloudinary.config({
      cloud_name: url.hostname || "dtiatadm7", // Use provided cloud name as fallback
      api_key: url.username,
      api_secret: url.password,
      secure: true // Always use HTTPS URLs
    });
    
    console.log("Cloudinary configured successfully with cloud:", url.hostname || "dtiatadm7");
  } catch (error) {
    console.error("Failed to parse CLOUDINARY_URL:", error);
    // Fallback configuration
    cloudinary.config({
      cloud_name: "dtiatadm7",
      secure: true
    });
    console.warn("Using fallback Cloudinary configuration - uploads may fail without proper credentials");
  }
} else {
  console.warn("CLOUDINARY_URL not configured - image upload will not work");
}

// Multer configuration for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Only allow 1 file upload at a time
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedTypes = [
      'image/jpeg',
      'image/png', 
      'image/webp',
      'image/avif',
      'image/heic'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')} files are allowed.`));
    }
  }
});

// Multer error handling middleware
function handleMulterError(error: any, req: Request, res: Response, next: NextFunction) {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(413).json({
          error: "File too large",
          message: "Please upload an image smaller than 5MB"
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: "Too many files",
          message: "Only one file can be uploaded at a time"
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: "Unexpected file field",
          message: "Please use the 'image' field for file upload"
        });
      default:
        return res.status(400).json({
          error: "Upload error",
          message: error.message || "File upload failed"
        });
    }
  }
  
  // Handle custom file filter errors
  if (error && error.message && error.message.includes('Invalid file type')) {
    console.error('File type validation error:', error);
    return res.status(400).json({
      error: "Invalid file type",
      message: error.message
    });
  }
  
  // Pass through other errors
  next(error);
}

// Admin middleware
async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.cookies?.adminSession;
    if (!sessionId) {
      return res.status(401).json({ error: "Admin authentication required" });
    }

    const session = await storage.getAdminSession(sessionId);
    if (!session || session.expiresAt < new Date()) {
      // Clean up expired session
      if (session) {
        await storage.deleteAdminSession(sessionId);
      }
      res.clearCookie("adminSession");
      return res.status(401).json({ error: "Session expired" });
    }

    // Add session to request for use in route handlers
    (req as any).adminSession = session;
    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve generated images
  app.get("/api/images/generated_images/:filename", (req, res) => {
    const { filename } = req.params;
    const imagePath = `./attached_assets/generated_images/${filename}`;
    res.sendFile(imagePath, { root: process.cwd() });
  });

  // Admin Authentication Routes
  app.post("/api/admin/login", checkAdminLoginRateLimit, async (req, res) => {
    try {
      const { password } = adminLoginSchema.parse(req.body);
      
      // Check admin password from environment
      if (!process.env.ADMIN_PASSWORD) {
        return res.status(500).json({ error: "Admin authentication not configured" });
      }
      
      if (password !== process.env.ADMIN_PASSWORD) {
        // Record failed login attempt for rate limiting
        recordFailedAdminLogin(req);
        return res.status(401).json({ error: "Invalid password" });
      }
      
      // Create admin session
      const sessionId = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour session
      
      await storage.createAdminSession({
        sessionId,
        expiresAt
      });
      
      // Set httpOnly cookie
      res.cookie("adminSession", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/'
      });
      
      res.json({ success: true, message: "Admin authenticated successfully" });
    } catch (error) {
      console.error("Admin login error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid login data", details: error.errors });
      } else {
        res.status(500).json({ error: "Login failed" });
      }
    }
  });

  app.post("/api/admin/logout", requireAdminAuth, async (req, res) => {
    try {
      const sessionId = req.cookies?.adminSession;
      if (sessionId) {
        await storage.deleteAdminSession(sessionId);
      }
      res.clearCookie("adminSession");
      res.json({ success: true, message: "Logged out successfully" });
    } catch (error) {
      console.error("Admin logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // Categories Routes
  // Public endpoint to get all categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      console.error("Get categories error:", error);
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  // Public endpoint to get single category
  app.get("/api/categories/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const category = await storage.getCategory(id);
      
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      res.json(category);
    } catch (error) {
      console.error("Get category error:", error);
      res.status(500).json({ error: "Failed to get category" });
    }
  });

  // Admin only - Create new category
  app.post("/api/categories", requireAdminAuth, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      
      // Check if category with same name already exists
      const existingCategory = await storage.getCategoryByName(categoryData.name);
      if (existingCategory) {
        return res.status(409).json({ 
          error: "Category already exists", 
          message: `Category with name "${categoryData.name}" already exists`
        });
      }
      
      const category = await storage.createCategory(categoryData);
      console.log(`Admin created category: ${category.name} (ID: ${category.id})`);
      res.status(201).json(category);
    } catch (error) {
      console.error("Create category error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid category data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create category" });
      }
    }
  });

  // Admin only - Update category
  app.patch("/api/categories/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = insertCategorySchema.partial().parse(req.body);
      
      // Check if category exists
      const existingCategory = await storage.getCategory(id);
      if (!existingCategory) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // If updating name, check if new name already exists (excluding current category)
      if (updates.name) {
        const categoryWithSameName = await storage.getCategoryByName(updates.name);
        if (categoryWithSameName && categoryWithSameName.id !== id) {
          return res.status(409).json({ 
            error: "Category name already exists", 
            message: `Another category with name "${updates.name}" already exists`
          });
        }
      }
      
      const updatedCategory = await storage.updateCategory(id, updates);
      if (!updatedCategory) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      console.log(`Admin updated category: ${updatedCategory.name} (ID: ${id})`);
      res.json(updatedCategory);
    } catch (error) {
      console.error("Update category error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid category data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update category" });
      }
    }
  });

  // Admin only - Delete category with protective functionality
  app.delete("/api/categories/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if category exists
      const category = await storage.getCategory(id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      // Check if any products reference this category (protective delete)
      const { products: productsInCategory } = await storage.getProductsByCategory(id, 1, 0);
      if (productsInCategory.length > 0) {
        const { total: totalProducts } = await storage.getProductsByCategory(id);
        return res.status(409).json({ 
          error: "Cannot delete category with products", 
          message: `Cannot delete category "${category.name}" because it has ${totalProducts} product${totalProducts !== 1 ? 's' : ''} assigned to it. Please reassign or delete the products first.`,
          details: {
            categoryName: category.name,
            productCount: totalProducts
          }
        });
      }
      
      // Safe to delete - no products reference this category
      const deleted = await storage.deleteCategory(id);
      if (!deleted) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      console.log(`Admin deleted category: ${category.name} (ID: ${id})`);
      res.json({ 
        success: true, 
        message: `Category "${category.name}" deleted successfully` 
      });
    } catch (error) {
      console.error("Delete category error:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  app.get("/api/admin/me", requireAdminAuth, async (req, res) => {
    try {
      const session = (req as any).adminSession;
      res.json({ 
        authenticated: true, 
        sessionId: session.id,
        expiresAt: session.expiresAt 
      });
    } catch (error) {
      console.error("Admin me error:", error);
      res.status(500).json({ error: "Failed to get admin info" });
    }
  });

  // Admin image upload endpoint
  app.post("/api/admin/uploads/image", requireAdminAuth, upload.single('image'), handleMulterError, async (req: Request, res: Response) => {
    try {
      if (!process.env.CLOUDINARY_URL) {
        return res.status(500).json({ 
          error: "Image upload service not configured",
          message: "CLOUDINARY_URL environment variable is missing" 
        });
      }

      if (!req.file) {
        return res.status(400).json({ 
          error: "No file uploaded",
          message: "Please select an image file to upload" 
        });
      }

      // Upload to Cloudinary using upload_stream for memory buffer
      const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "kary-perfumes/products",
            transformation: [
              { fetch_format: "auto", quality: "auto" },
              { width: 800, height: 800, crop: "limit" }
            ],
            unique_filename: true,
            use_filename: true,
            filename_override: `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              reject(error);
            } else {
              resolve(result);
            }
          }
        );
        
        uploadStream.end(req.file!.buffer);
      });

      const result = await uploadPromise as any;

      // Return structured response
      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format
      });

    } catch (error: any) {
      console.error("Image upload error:", error);
      
      // Handle specific Cloudinary errors
      if (error.http_code === 413) {
        return res.status(413).json({ 
          error: "File too large",
          message: "Please upload an image smaller than 5MB" 
        });
      }
      
      if (error.message && error.message.includes("Invalid file type")) {
        return res.status(400).json({ 
          error: "Invalid file type",
          message: error.message 
        });
      }
      
      res.status(500).json({ 
        error: "Upload failed",
        message: "Failed to upload image. Please try again." 
      });
    }
  });

  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      // Check if pagination params are explicitly provided
      const pageParam = req.query.page;
      const limitParam = req.query.limit;
      const hasPaginationParams = pageParam !== undefined || limitParam !== undefined;
      
      if (hasPaginationParams) {
        // Return paginated response when pagination params are provided
        const { page, limit, offset } = validateAndParsePagination(req);
        const result = await storage.getAllProducts(limit, offset);
        
        // Convert prices from cents to KSh for frontend
        const productsWithPrices = result.products.map(product => ({
          ...product,
          price: product.price / 100,
          originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
        }));
        
        const paginatedResponse = createPaginationResponse(
          productsWithPrices,
          result.total,
          page,
          limit
        );
        
        res.json(paginatedResponse);
      } else {
        // Legacy format: return array directly for backward compatibility
        const result = await storage.getAllProducts();
        
        // Convert prices from cents to KSh for frontend
        const productsWithPrices = result.products.map(product => ({
          ...product,
          price: product.price / 100,
          originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
        }));
        
        res.json(productsWithPrices);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/category/:categoryId", async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { page, limit, offset } = validateAndParsePagination(req);
      
      // Validate that category exists
      const category = await storage.getCategory(categoryId);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      
      const result = await storage.getProductsByCategory(categoryId, limit, offset);
      
      // Convert prices from cents to KSh for frontend
      const productsWithPrices = result.products.map(product => ({
        ...product,
        price: product.price / 100,
        originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
      }));
      
      const paginatedResponse = createPaginationResponse(
        productsWithPrices,
        result.total,
        page,
        limit
      );
      
      res.json(paginatedResponse);
    } catch (error) {
      console.error("Error fetching products by category:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      // Convert prices from cents to KSh for frontend
      const productWithPrice = {
        ...product,
        price: product.price / 100,
        originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
      };
      res.json(productWithPrice);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", requireAdminAuth, async (req, res) => {
    try {
      // Convert prices from KSh to cents for storage
      const productData = {
        ...req.body,
        price: Math.round(req.body.price * 100),
        originalPrice: req.body.originalPrice ? Math.round(req.body.originalPrice * 100) : undefined,
      };
      
      const validatedData = insertProductSchema.parse(productData);
      const product = await storage.createProduct(validatedData);
      
      // Convert back for response
      const productWithPrice = {
        ...product,
        price: product.price / 100,
        originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
      };
      
      res.status(201).json(productWithPrice);
    } catch (error) {
      console.error("Error creating product:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid product data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create product" });
      }
    }
  });

  app.put("/api/products/:id", requireAdminAuth, async (req, res) => {
    try {
      // Convert prices from KSh to cents for storage
      const updateData = {
        ...req.body,
        price: req.body.price ? Math.round(req.body.price * 100) : undefined,
        originalPrice: req.body.originalPrice ? Math.round(req.body.originalPrice * 100) : undefined,
      };
      
      const product = await storage.updateProduct(req.params.id, updateData);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Convert back for response
      const productWithPrice = {
        ...product,
        price: product.price / 100,
        originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
      };
      
      res.json(productWithPrice);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", requireAdminAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteProduct(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  // Review routes
  app.post("/api/products/:id/reviews", checkReviewRateLimit, async (req, res) => {
    try {
      const productId = req.params.id;
      
      // Verify product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Hash phone number if provided for privacy
      let customerPhoneHash = null;
      if (req.body.customerPhone) {
        customerPhoneHash = crypto.createHash('sha256')
          .update(req.body.customerPhone)
          .digest('hex');
      }

      const reviewData = {
        ...req.body,
        productId,
        customerPhoneHash,
        customerPhone: undefined, // Don't store raw phone
        status: "approved", // Auto-approve reviews for better user experience
      };
      
      const validatedData = insertReviewSchema.parse(reviewData);
      const review = await storage.createReview(validatedData);
      
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid review data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create review" });
      }
    }
  });

  app.get("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = req.params.id;
      
      // Verify product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      // Get approved reviews only for public endpoint
      const reviews = await storage.getProductReviews(productId, "approved");
      const averageRating = await storage.getProductAverageRating(productId);
      
      res.json({
        reviews,
        averageRating: Number(averageRating.toFixed(1)),
        totalReviews: reviews.length
      });
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.get("/api/admin/reviews", requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      
      // Use getAllReviews for proper filtering - it handles both 'all' and specific status
      const result = await storage.getAllReviews(status, limit, offset);
      
      res.json({
        reviews: result.reviews,
        total: result.total,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching admin reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.patch("/api/admin/reviews/:id", requireAdminAuth, async (req, res) => {
    try {
      console.log("Review update request:", {
        reviewId: req.params.id,
        body: req.body,
        adminSession: (req as any).adminSession?.id
      });
      
      const reviewId = req.params.id;
      const statusUpdate = updateReviewStatusSchema.parse(req.body);
      
      console.log("Parsed status update:", statusUpdate);
      
      const review = await storage.getReviewById(reviewId);
      if (!review) {
        console.error("Review not found for ID:", reviewId);
        return res.status(404).json({ error: "Review not found" });
      }
      
      console.log("Found review before update:", {
        id: review.id,
        currentStatus: review.status,
        productId: review.productId
      });
      
      const updatedReview = await storage.updateReviewStatus(reviewId, statusUpdate);
      if (!updatedReview) {
        console.error("Failed to update review - no result returned");
        return res.status(404).json({ error: "Review not found" });
      }
      
      console.log("Review updated successfully:", {
        id: updatedReview.id,
        oldStatus: review.status,
        newStatus: updatedReview.status
      });
      
      res.json(updatedReview);
    } catch (error) {
      console.error("Error updating review status:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid status data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update review status" });
      }
    }
  });

  // Admin review CRUD routes
  app.post("/api/admin/reviews", requireAdminAuth, async (req, res) => {
    try {
      const validatedData = insertReviewSchema.parse(req.body);
      const review = await storage.createReview(validatedData);
      res.status(201).json(review);
    } catch (error) {
      console.error("Error creating review:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid review data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create review" });
      }
    }
  });

  app.put("/api/admin/reviews/:id", requireAdminAuth, async (req, res) => {
    try {
      const reviewId = req.params.id;
      const validatedData = insertReviewSchema.partial().parse(req.body);
      
      const review = await storage.getReviewById(reviewId);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      
      const updatedReview = await storage.updateReview(reviewId, validatedData);
      if (!updatedReview) {
        return res.status(404).json({ error: "Review not found" });
      }
      
      res.json(updatedReview);
    } catch (error) {
      console.error("Error updating review:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid review data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update review" });
      }
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdminAuth, async (req, res) => {
    try {
      const reviewId = req.params.id;
      
      const review = await storage.getReviewById(reviewId);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      
      const deleted = await storage.deleteReview(reviewId);
      if (!deleted) {
        return res.status(500).json({ error: "Failed to delete review" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Restore soft-deleted review (admin only)
  app.post("/api/admin/reviews/:id/restore", requireAdminAuth, async (req, res) => {
    try {
      const reviewId = req.params.id;
      
      const review = await storage.getReviewById(reviewId);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      
      const restoredReview = await storage.restoreReview(reviewId);
      if (!restoredReview) {
        return res.status(500).json({ error: "Failed to restore review" });
      }
      
      res.json(restoredReview);
    } catch (error) {
      console.error("Error restoring review:", error);
      res.status(500).json({ error: "Failed to restore review" });
    }
  });

  // Enhanced GET route for admin reviews with search functionality
  app.get("/api/admin/reviews/search", requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      const search = req.query.search as string;
      
      if (search) {
        const result = await storage.searchReviews(search, status, limit, offset);
        res.json(result);
      } else {
        const result = await storage.getAllReviews(status, limit, offset);
        res.json(result);
      }
    } catch (error) {
      console.error("Error searching reviews:", error);
      res.status(500).json({ error: "Failed to search reviews" });
    }
  });

  // Admin Products endpoint (distinct from public products)
  app.get("/api/admin/products", requireAdminAuth, async (req, res) => {
    try {
      // Check if pagination params are explicitly provided
      const pageParam = req.query.page;
      const limitParam = req.query.limit;
      const hasPaginationParams = pageParam !== undefined || limitParam !== undefined;
      
      if (hasPaginationParams) {
        // Return paginated response when pagination params are provided
        const { page, limit, offset } = validateAndParsePagination(req);
        const result = await storage.getAllProducts(limit, offset);
        
        // Convert prices from cents to KSh for frontend
        const productsWithPrices = result.products.map(product => ({
          ...product,
          price: product.price / 100,
          originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
        }));
        
        const paginatedResponse = createPaginationResponse(
          productsWithPrices,
          result.total,
          page,
          limit
        );
        
        res.json(paginatedResponse);
      } else {
        // Legacy format: return array directly for backward compatibility
        const result = await storage.getAllProducts();
        
        // Convert prices from cents to KSh for frontend
        const productsWithPrices = result.products.map(product => ({
          ...product,
          price: product.price / 100,
          originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
        }));
        
        res.json(productsWithPrices);
      }
    } catch (error) {
      console.error("Error fetching admin products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  // Admin API Routes
  app.get("/api/admin/orders", requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string;
      const search = req.query.search as string;
      
      let result;
      if (search) {
        // If search query provided, search with optional status filter
        result = await storage.searchOrders(search, status, limit, offset);
      } else if (status) {
        // If only status filter provided
        result = await storage.getOrdersByStatus(status, limit, offset);
      } else {
        // No filters, get all orders
        result = await storage.getAllOrders(limit, offset);
      }
      
      // Convert prices from cents to KSh for frontend
      const ordersWithPrices = result.orders.map(order => ({
        ...order,
        deliveryCharge: order.deliveryCharge / 100,
        subtotal: order.subtotal / 100,
        total: order.total / 100,
      }));
      
      res.json({
        orders: ordersWithPrices,
        total: result.total,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching admin orders:", error);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.patch("/api/admin/orders/:id/status", requireAdminAuth, async (req, res) => {
    try {
      const { status } = req.body;
      
      if (!status || !['pending', 'processing', 'shipped', 'delivered'].includes(status)) {
        return res.status(400).json({ error: "Invalid status. Must be: pending, processing, shipped, or delivered" });
      }
      
      const updatedOrder = await storage.updateOrderStatus(req.params.id, status);
      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Convert prices from cents to KSh for frontend
      const orderWithPrice = {
        ...updatedOrder,
        deliveryCharge: updatedOrder.deliveryCharge / 100,
        subtotal: updatedOrder.subtotal / 100,
        total: updatedOrder.total / 100,
      };
      
      res.json(orderWithPrice);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.delete("/api/admin/orders/:id", requireAdminAuth, async (req, res) => {
    try {
      const deleted = await storage.deleteOrder(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting order:", error);
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  app.get("/api/admin/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      
      // Keep revenue in cents for consistent API - client will format for display
      const statsWithPrice = {
        ...stats,
        totalRevenue: stats.totalRevenue
      };
      
      res.json(statsWithPrice);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Admin Payment Management Routes
  app.get("/api/admin/payments", requireAdminAuth, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const methodParam = req.query.method as string;
      const status = req.query.status as string;
      const search = req.query.search as string;
      
      let result;
      
      // Support combined filtering (method AND status)
      const hasMethodFilter = methodParam && methodParam !== 'all' && (methodParam === 'stripe' || methodParam === 'mpesa');
      const hasStatusFilter = status && status !== 'all';
      
      if (hasMethodFilter && hasStatusFilter) {
        // Get all payments and filter both method and status
        const allPayments = await storage.getAllPayments(limit * 2, offset); // Get more to allow for filtering
        const filteredPayments = allPayments.payments.filter(payment => 
          payment.paymentMethod === methodParam && payment.status === status
        );
        result = {
          payments: filteredPayments.slice(0, limit),
          total: filteredPayments.length
        };
      } else if (hasMethodFilter) {
        result = await storage.getPaymentsByMethod(methodParam as 'stripe' | 'mpesa', limit, offset);
      } else if (hasStatusFilter) {
        result = await storage.getPaymentsByStatus(status, limit, offset);
      } else {
        result = await storage.getAllPayments(limit, offset);
      }
      
      let filteredPayments = result.payments;
      
      // Apply search filter if provided
      if (search && search.trim()) {
        const searchTerm = search.trim().toLowerCase();
        filteredPayments = filteredPayments.filter(payment => 
          payment.orderId.toLowerCase().includes(searchTerm) ||
          (payment.transactionId && payment.transactionId.toLowerCase().includes(searchTerm))
        );
      }
      
      // Keep amounts in cents for consistent API - client will format for display
      const paymentsWithPrices = filteredPayments.map(payment => ({
        ...payment,
        amount: payment.amount,
        processingFee: payment.processingFee,
      }));
      
      res.json({
        payments: paymentsWithPrices,
        total: search ? filteredPayments.length : result.total,
        limit,
        offset
      });
    } catch (error) {
      console.error("Error fetching admin payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  app.get("/api/admin/payments/analytics", requireAdminAuth, async (req, res) => {
    try {
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const analytics = await storage.getPaymentAnalytics(startDate, endDate);
      
      // Keep amounts in cents for consistent API - client will format for display
      const analyticsWithPrices = {
        ...analytics,
        totalRevenue: analytics.totalRevenue,
        averageProcessingFee: analytics.averageProcessingFee,
      };
      
      res.json(analyticsWithPrices);
    } catch (error) {
      console.error("Error fetching payment analytics:", error);
      res.status(500).json({ error: "Failed to fetch payment analytics" });
    }
  });

  // Create payment record (admin only)
  app.post("/api/admin/payments", requireAdminAuth, async (req, res) => {
    try {
      const validatedData = insertPaymentSchema.parse(req.body);
      
      const payment = await storage.createPayment(validatedData);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid payment data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create payment" });
      }
    }
  });

  // Update payment record (admin only)
  app.put("/api/admin/payments/:id", requireAdminAuth, async (req, res) => {
    try {
      const validatedData = updatePaymentSchema.parse(req.body);
      
      const payment = await storage.updatePayment(req.params.id, validatedData);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }
      
      res.json(payment);
    } catch (error) {
      console.error("Error updating payment:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid payment data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to update payment" });
      }
    }
  });

  // Delete payment record (admin only)
  app.delete("/api/admin/payments/:id", requireAdminAuth, async (req, res) => {
    try {
      const deleted = await storage.deletePayment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Payment not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting payment:", error);
      res.status(500).json({ error: "Failed to delete payment" });
    }
  });

  // Stripe payment routes (using blueprint pattern)
  app.post("/api/create-payment-intent", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Payment processing not configured. Missing Stripe keys." });
    }

    try {
      const { amount, orderId } = req.body; // Amount in KSh and orderId for metadata
      
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required to create payment intent" });
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "kes", // Kenyan Shilling
        metadata: {
          orderId: orderId,
          source: "kary-scents-web"
        }
      });
      
      console.log(`Stripe payment intent created:`, {
        paymentIntentId: paymentIntent.id,
        orderId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ error: "Error creating payment intent: " + error.message });
    }
  });

  // Confirm Stripe payment and send receipt email - SECURE VERSION
  app.post("/api/payments/stripe/confirm", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Payment processing not configured. Missing Stripe keys." });
    }

    try {
      // SECURITY: Validate request body with Zod schema
      const validatedRequest = stripeConfirmPaymentSchema.parse(req.body);
      const { orderId, paymentIntentId } = validatedRequest;

      // Get the order
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.error(`Payment confirmation failed: Order ${orderId} not found`);
        return res.status(404).json({ error: "Order not found" });
      }

      // SECURITY: Verify payment intent with Stripe and perform comprehensive verification
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      // SECURITY CHECK 1: Payment must be completed successfully
      if (paymentIntent.status !== 'succeeded') {
        console.error(`Payment confirmation failed: Payment not completed`, {
          orderId,
          paymentIntentId,
          status: paymentIntent.status
        });
        return res.status(400).json({ 
          error: "Payment not completed", 
          status: paymentIntent.status 
        });
      }

      // SECURITY CHECK 2: Verify payment amount matches order total
      const orderTotalCents = order.total; // Already in cents in DB
      if (paymentIntent.amount !== orderTotalCents) {
        console.error(`Payment spoofing attempt detected: Amount mismatch`, {
          orderId,
          paymentIntentId,
          expectedAmount: orderTotalCents,
          actualAmount: paymentIntent.amount
        });
        return res.status(400).json({ 
          error: "Payment amount verification failed",
          details: "Payment amount does not match order total"
        });
      }

      // SECURITY CHECK 3: Verify currency is correct
      if (paymentIntent.currency !== 'kes') {
        console.error(`Payment spoofing attempt detected: Currency mismatch`, {
          orderId,
          paymentIntentId,
          expectedCurrency: 'kes',
          actualCurrency: paymentIntent.currency
        });
        return res.status(400).json({ 
          error: "Payment currency verification failed",
          details: "Payment currency does not match expected currency"
        });
      }

      // SECURITY CHECK 4: Verify this payment was created for this specific order
      if (!paymentIntent.metadata || paymentIntent.metadata.orderId !== orderId) {
        console.error(`Payment spoofing attempt detected: Order ID mismatch in metadata`, {
          orderId,
          paymentIntentId,
          expectedOrderId: orderId,
          actualOrderId: paymentIntent.metadata?.orderId || 'missing'
        });
        return res.status(400).json({ 
          error: "Payment verification failed",
          details: "Payment was not created for this order"
        });
      }

      // SECURITY CHECK 5: Ensure order hasn't already been paid for
      if (order.paymentMethod === 'stripe' && order.stripePaymentIntentId) {
        console.warn(`Duplicate payment confirmation attempt for already paid order`, {
          orderId,
          existingPaymentIntentId: order.stripePaymentIntentId,
          newPaymentIntentId: paymentIntentId
        });
        return res.status(400).json({ 
          error: "Order already paid",
          details: "This order has already been successfully paid"
        });
      }

      // All security checks passed - proceed with payment confirmation
      
      // Check if payment record already exists (for idempotency)
      let payment = await storage.getPaymentByTransactionId(paymentIntentId);
      
      if (!payment) {
        // Create payment record in payments table
        payment = await storage.createPayment({
          orderId: order.id,
          paymentMethod: 'stripe',
          amount: order.total, // Keep in cents for consistency
          currency: 'KES',
          status: 'completed', // Stripe payments are confirmed when we reach this point
          transactionId: paymentIntentId,
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: paymentIntent.latest_charge as string,
          processingFee: Math.round((paymentIntent.amount * 0.036) + 15), // Stripe KE fees: 3.6% + KSh 15
          gatewayResponse: {
            paymentIntent: {
              id: paymentIntent.id,
              status: paymentIntent.status,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              created: paymentIntent.created
            }
          },
          initiatedAt: new Date(paymentIntent.created * 1000),
          processedAt: new Date(),
          completedAt: new Date(),
        });
        
        console.log(`Created Stripe payment record:`, {
          paymentId: payment.id,
          orderId: order.id,
          amount: payment.amount,
          transactionId: paymentIntentId
        });
      } else {
        // Update existing payment record to completed
        const updatedPayment = await storage.updatePayment(payment.id, {
          status: 'completed',
          stripeChargeId: paymentIntent.latest_charge as string,
          processingFee: Math.round((paymentIntent.amount * 0.036) + 15), // Stripe KE fees: 3.6% + KSh 15
          gatewayResponse: {
            paymentIntent: {
              id: paymentIntent.id,
              status: paymentIntent.status,
              amount: paymentIntent.amount,
              currency: paymentIntent.currency,
              created: paymentIntent.created
            }
          },
          processedAt: new Date(),
          completedAt: new Date(),
        });
        
        if (updatedPayment) {
          payment = updatedPayment;
          console.log(`Updated Stripe payment record to completed:`, {
            paymentId: payment.id,
            orderId: order.id,
            transactionId: paymentIntentId
          });
        } else {
          console.error(`Failed to update Stripe payment record:`, {
            paymentId: payment.id,
            orderId: order.id,
            transactionId: paymentIntentId
          });
          return res.status(500).json({ error: "Failed to update payment record" });
        }
      }
      
      // Update order with payment intent
      const updatedOrder = await storage.updateOrderPaymentIntent(orderId, paymentIntentId);
      if (!updatedOrder) {
        console.error(`Failed to update order with payment intent`, { orderId, paymentIntentId });
        return res.status(500).json({ error: "Failed to update order" });
      }

      // SECURITY: Use proper generic payment update method instead of M-Pesa specific one
      await storage.updateOrderPayment(orderId, {
        paymentMethod: 'stripe',
        paidAt: new Date()
      });

      console.log(`SECURE: Stripe payment confirmed for order ${orderId}:`, {
        paymentIntentId,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        verifiedAmount: orderTotalCents,
        verifiedOrderId: orderId
      });

      // Send order receipt email
      try {
        const orderWithItems = await storage.getOrderWithItems(orderId);
        if (orderWithItems) {
          const emailSent = await sendOrderReceiptEmail({
            order: orderWithItems.order,
            items: orderWithItems.items
          });
          
          if (emailSent) {
            console.log(`Order receipt email sent successfully for order ${orderId}`);
          } else {
            console.warn(`Failed to send order receipt email for order ${orderId}`);
          }
        }
      } catch (emailError) {
        console.error(`Error sending order receipt email for order ${orderId}:`, {
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
          orderId
        });
        // Don't fail the payment confirmation if email fails
      }

      res.json({ 
        success: true, 
        message: "Payment securely confirmed and order updated",
        orderId,
        paymentIntentId,
        verifiedAmount: orderTotalCents / 100, // Convert back to KSh for response
        verifiedCurrency: 'kes'
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("Payment confirmation validation error:", error.errors);
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: error.errors 
        });
      }
      
      console.error("Error confirming Stripe payment:", {
        error: error.message,
        stack: error.stack
      });
      res.status(500).json({ error: "Payment confirmation failed: " + error.message });
    }
  });

  // Order routes
  app.post("/api/orders", async (req, res) => {
    try {
      // Security: Order creation details logged for debugging (PII removed)
      console.log("Order creation initiated:", {
        hasOrder: !!req.body.order,
        hasItems: Array.isArray(req.body.items),
        itemCount: req.body.items?.length || 0
      });
      const { order, items } = req.body;
      
      // Check if order exists and has required properties
      if (!order) {
        console.error("Order object is missing from request body");
        return res.status(400).json({ error: "Order data is required" });
      }
      
      if (!items || !Array.isArray(items)) {
        console.error("Items array is missing from request body");
        return res.status(400).json({ error: "Items array is required" });
      }
      
      // Check if order has the required numeric properties
      if (typeof order.deliveryCharge !== 'number' || 
          typeof order.subtotal !== 'number' || 
          typeof order.total !== 'number') {
        console.error("Order missing numeric properties:", {
          deliveryCharge: order.deliveryCharge,
          subtotal: order.subtotal,
          total: order.total
        });
        return res.status(400).json({ error: "Order must include deliveryCharge, subtotal, and total as numbers" });
      }
      
      // Convert prices from KSh to cents for storage
      const orderData = {
        ...order,
        deliveryCharge: Math.round(order.deliveryCharge * 100),
        subtotal: Math.round(order.subtotal * 100),
        total: Math.round(order.total * 100),
      };
      
      const orderItemsData = items.map((item: any) => ({
        ...item,
        productPrice: Math.round(item.productPrice * 100),
      }));
      
      const validatedOrder = insertOrderSchema.parse(orderData);
      const newOrder = await storage.createOrder(validatedOrder, orderItemsData);
      
      // Convert back for response
      const orderWithPrice = {
        ...newOrder,
        deliveryCharge: newOrder.deliveryCharge / 100,
        subtotal: newOrder.subtotal / 100,
        total: newOrder.total / 100,
      };
      
      res.status(201).json(orderWithPrice);
    } catch (error) {
      console.error("Error creating order:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid order data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create order" });
      }
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const orderWithItems = await storage.getOrderWithItems(req.params.id);
      if (!orderWithItems) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Convert prices back to KSh
      const { order, items } = orderWithItems;
      const orderWithPrice = {
        ...order,
        deliveryCharge: order.deliveryCharge / 100,
        subtotal: order.subtotal / 100,
        total: order.total / 100,
      };
      
      const itemsWithPrice = items.map(item => ({
        ...item,
        productPrice: item.productPrice / 100,
      }));
      
      res.json({ order: orderWithPrice, items: itemsWithPrice });
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ error: "Failed to fetch order" });
    }
  });

  // Payment rate limiting has been removed for better user experience

  // Mpesa Payment Routes
  app.post("/api/payments/mpesa/initiate", async (req, res) => {
    try {
      const { orderId, phone } = req.body;

      if (!mpesaService.isConfigured()) {
        return res.status(500).json({ 
          error: "Mpesa payment is not configured. Please contact support." 
        });
      }

      // Validate input
      if (!orderId || !phone) {
        return res.status(400).json({ 
          error: "Order ID and phone number are required" 
        });
      }

      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Check if order can be paid
      if (order.status === 'delivered') {
        return res.status(400).json({ error: "Cannot pay for delivered order" });
      }

      if (order.mpesaStatus === 'paid') {
        return res.status(400).json({ error: "Order has already been paid" });
      }

      // Normalize phone number
      let normalizedPhone: string;
      try {
        normalizedPhone = mpesaService.normalizePhoneNumber(phone);
      } catch (error: any) {
        return res.status(400).json({ error: error.message });
      }

      // Convert amount from cents to KES for Mpesa
      const amount = order.total / 100;

      // Initiate STK Push
      const stkResult = await mpesaService.initiateSTKPush({
        phone: normalizedPhone,
        amount,
        orderId: order.id,
        accountReference: `KARY-${order.id.substring(0, 8)}`,
        transactionDesc: `Payment for Kary Perfumes order ${order.id.substring(0, 8)}`,
      });

      // Create payment record in new payments table
      await storage.createPayment({
        orderId: order.id,
        paymentMethod: 'mpesa',
        amount: order.total, // Keep in cents for consistency
        currency: 'KES',
        status: 'pending',
        mpesaMerchantRequestId: stkResult.merchantRequestID,
        mpesaCheckoutRequestId: stkResult.checkoutRequestID,
        mpesaPhone: normalizedPhone,
        initiatedAt: new Date(),
        retryCount: order.paymentRetryCount || 0,
      });

      // Update order with minimal payment info for backward compatibility
      await storage.updateOrderMpesaDetails(order.id, {
        mpesaMerchantRequestId: stkResult.merchantRequestID,
        mpesaCheckoutRequestId: stkResult.checkoutRequestID,
        mpesaStatus: 'initiated',
        mpesaPhone: normalizedPhone,
        paymentMethod: 'mpesa',
      });

      console.log(`STK Push initiated for order ${order.id}:`, {
        merchantRequestID: stkResult.merchantRequestID,
        checkoutRequestID: stkResult.checkoutRequestID,
        customerMessage: stkResult.customerMessage,
      });

      res.json({
        success: true,
        checkoutRequestID: stkResult.checkoutRequestID,
        merchantRequestID: stkResult.merchantRequestID,
        customerMessage: stkResult.customerMessage,
      });
    } catch (error: any) {
      console.error("Error initiating Mpesa payment:", error);
      res.status(500).json({ 
        error: "Failed to initiate payment", 
        details: error.message 
      });
    }
  });

  app.post("/api/payments/mpesa/callback", async (req, res) => {
    const startTime = Date.now();
    let orderFound = false;
    let callbackProcessed = false;
    
    try {
      // Security: Mpesa callback received (sensitive data not logged)
      console.log("Mpesa callback received:", {
        hasBody: !!req.body,
        checkoutRequestId: req.body?.Body?.stkCallback?.CheckoutRequestID ? "[PRESENT]" : "[MISSING]",
        resultCode: req.body?.Body?.stkCallback?.ResultCode
      });

      // Extract auth token from headers
      const authToken = req.headers['x-mpesa-auth-token'] as string;

      // Validate callback structure and authentication
      if (!mpesaService.validateCallback(req.body, authToken)) {
        console.error("Invalid callback structure or authentication:", {
          body: req.body,
          hasAuth: !!authToken,
          headers: req.headers
        });
        return res.status(400).json({ error: "Invalid callback structure or authentication" });
      }

      // Extract callback details
      const callbackDetails = mpesaService.extractCallbackDetails(req.body);
      
      // Store raw callback for audit
      console.log("Callback details extracted:", {
        checkoutRequestID: callbackDetails.checkoutRequestID,
        resultCode: callbackDetails.resultCode,
        resultDesc: callbackDetails.resultDesc,
        amount: callbackDetails.amount,
        receipt: callbackDetails.mpesaReceiptNumber
      });

      // Find order by CheckoutRequestID
      const order = await storage.getOrderByCheckoutRequestId(
        callbackDetails.checkoutRequestID
      );

      if (!order) {
        console.error("Order not found for CheckoutRequestID:", callbackDetails.checkoutRequestID);
        return res.status(404).json({ error: "Order not found" });
      }
      
      orderFound = true;

      // Find payment record by CheckoutRequestID
      const payment = await storage.getPaymentByMpesaCheckoutId(
        callbackDetails.checkoutRequestID
      );

      if (!payment) {
        console.error("Payment record not found for CheckoutRequestID:", callbackDetails.checkoutRequestID);
        return res.status(404).json({ error: "Payment record not found" });
      }

      // Idempotent processing - only allow certain status transitions
      if (payment.status === 'completed') {
        console.log("Payment already processed as completed:", payment.id);
        callbackProcessed = true;
        return res.json({ status: "OK", message: "Already processed" });
      }

      if (order.mpesaStatus === 'failed' && callbackDetails.resultCode === 0) {
        console.warn("Attempting to mark failed payment as successful:", {
          orderId: order.id,
          currentStatus: order.mpesaStatus,
          resultCode: callbackDetails.resultCode
        });
      }

      // Validate payment amount matches order total (allow small variance for rounding)
      if (callbackDetails.resultCode === 0 && callbackDetails.amount) {
        const expectedAmount = order.total / 100; // Convert cents to KSh
        const actualAmount = callbackDetails.amount;
        const variance = Math.abs(expectedAmount - actualAmount);
        
        if (variance > 1) {
          console.error("Payment amount mismatch:", {
            orderId: order.id,
            expected: expectedAmount,
            actual: actualAmount,
            variance: variance
          });
          
          // Update payment record to failed
          await storage.updatePayment(payment.id, {
            status: 'failed',
            failureReason: 'Payment amount mismatch',
            failureCode: 'AMOUNT_MISMATCH',
            failedAt: new Date(),
            mpesaReceiptNumber: callbackDetails.mpesaReceiptNumber || undefined,
            gatewayResponse: req.body,
          });

          // Update order for backward compatibility
          await storage.updateOrderMpesaDetails(order.id, {
            mpesaStatus: 'failed',
            mpesaReceiptNumber: callbackDetails.mpesaReceiptNumber || undefined,
          });
          
          callbackProcessed = true;
          return res.json({ status: "OK", message: "Amount mismatch - marked as failed" });
        }
      }

      // Update payment record based on payment result
      if (callbackDetails.resultCode === 0) {
        // Payment successful
        await storage.updatePayment(payment.id, {
          status: 'completed',
          receiptNumber: callbackDetails.mpesaReceiptNumber || undefined,
          mpesaReceiptNumber: callbackDetails.mpesaReceiptNumber || undefined,
          completedAt: callbackDetails.transactionDate || new Date(),
          processedAt: new Date(),
          gatewayResponse: req.body,
        });

        // Update order for backward compatibility
        await storage.updateOrderMpesaDetails(order.id, {
          mpesaStatus: 'paid',
          mpesaReceiptNumber: callbackDetails.mpesaReceiptNumber || undefined,
          paidAt: callbackDetails.transactionDate || new Date(),
        });

        console.log(`Payment successful for order ${order.id}:`, {
          receipt: callbackDetails.mpesaReceiptNumber,
          amount: callbackDetails.amount,
          expectedAmount: order.total / 100
        });
      } else if (callbackDetails.resultCode === 1032) {
        // Payment cancelled by user
        await storage.updatePayment(payment.id, {
          status: 'failed',
          failureReason: callbackDetails.resultDesc || 'Request cancelled by user',
          failureCode: callbackDetails.resultCode?.toString() || '1032',
          failedAt: new Date(),
          processedAt: new Date(),
          gatewayResponse: req.body,
        });

        // Update order with cancelled status for proper frontend feedback
        await storage.updateOrderMpesaDetails(order.id, {
          mpesaStatus: 'cancelled',
        });

        console.log(`Payment cancelled by user for order ${order.id}:`, {
          resultCode: callbackDetails.resultCode,
          resultDesc: callbackDetails.resultDesc,
        });
      } else {
        // Payment failed (other error codes)
        await storage.updatePayment(payment.id, {
          status: 'failed',
          failureReason: callbackDetails.resultDesc || 'Payment failed',
          failureCode: callbackDetails.resultCode?.toString() || 'UNKNOWN',
          failedAt: new Date(),
          processedAt: new Date(),
          gatewayResponse: req.body,
        });

        // Update order for backward compatibility
        await storage.updateOrderMpesaDetails(order.id, {
          mpesaStatus: 'failed',
        });

        console.log(`Payment failed for order ${order.id}:`, {
          resultCode: callbackDetails.resultCode,
          resultDesc: callbackDetails.resultDesc,
        });
      }

      callbackProcessed = true;
      
      // Always respond with 200 to Safaricom
      res.json({ status: "OK" });
    } catch (error: any) {
      console.error("Error processing Mpesa callback:", {
        error: error.message,
        stack: error.stack,
        orderFound,
        callbackProcessed,
        processingTime: Date.now() - startTime
      });
      
      // Still respond with 200 to prevent Safaricom retries
      res.json({ status: "ERROR", message: error.message });
    }
  });

  app.get("/api/orders/:id/payment-status", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // For M-Pesa payments that are still pending, query real-time status
      if (
        order.paymentMethod === 'mpesa' && 
        order.mpesaStatus === 'initiated' && 
        order.mpesaCheckoutRequestId &&
        mpesaService.isConfigured()
      ) {
        try {
          // Generate credentials for STK query
          const timestamp = mpesaService.generateTimestamp();
          const password = mpesaService.generatePassword(timestamp);

          // Query M-Pesa for real-time status
          const statusResult = await mpesaService.querySTKStatus({
            businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE || "",
            password: password,
            timestamp: timestamp,
            checkoutRequestID: order.mpesaCheckoutRequestId,
          });

          console.log(`Real-time M-Pesa status for order ${order.id}:`, statusResult);

          // Update order status based on M-Pesa response
          let updatedOrder = order;
          if (statusResult.resultCode === '0') {
            // Payment successful
            await storage.updateOrderMpesaDetails(order.id, {
              mpesaStatus: 'paid',
              paidAt: new Date(),
              mpesaReceiptNumber: 'Auto-detected', // M-Pesa doesn't provide receipt in query response
            });
            const fetchedOrder = await storage.getOrder(req.params.id);
            if (fetchedOrder) {
              updatedOrder = fetchedOrder;
            }
            console.log(`Order ${order.id} marked as paid via real-time query`);

          } else if (statusResult.resultCode === '1032') {
            // User cancelled transaction
            await storage.updateOrderMpesaDetails(order.id, {
              mpesaStatus: 'cancelled',
            });
            const fetchedOrder = await storage.getOrder(req.params.id);
            if (fetchedOrder) {
              updatedOrder = fetchedOrder;
            }
            console.log(`Order ${order.id} marked as cancelled via real-time query`);

          } else if (
            statusResult.resultCode === '1037' || // Invalid transaction
            statusResult.resultCode === '1001' || // Invalid transaction
            statusResult.resultCode === '9999'    // Request timeout or other error
          ) {
            // Transaction failed
            await storage.updateOrderMpesaDetails(order.id, {
              mpesaStatus: 'failed',
            });
            const fetchedOrder = await storage.getOrder(req.params.id);
            if (fetchedOrder) {
              updatedOrder = fetchedOrder;
            }
            console.log(`Order ${order.id} marked as failed via real-time query. Result: ${statusResult.resultDesc}`);
          }
          // For other result codes (like 1037 pending), keep current status

          // Return updated status
          return res.json({
            orderId: updatedOrder.id,
            status: updatedOrder.status,
            paymentMethod: updatedOrder.paymentMethod,
            mpesaStatus: updatedOrder.mpesaStatus,
            paidAt: updatedOrder.paidAt,
            mpesaReceiptNumber: updatedOrder.mpesaReceiptNumber,
            total: updatedOrder.total / 100, // Convert back to KSh
            realTimeUpdate: true, // Flag to indicate this was updated via real-time query
          });

        } catch (queryError: any) {
          // If M-Pesa query fails, fall back to stored status but log the error
          console.warn(`Failed to query M-Pesa status for order ${order.id}:`, queryError.message);
          // Continue with stored status below
        }
      }

      // Return stored status (fallback or for non-M-Pesa payments)
      res.json({
        orderId: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        mpesaStatus: order.mpesaStatus,
        paidAt: order.paidAt,
        mpesaReceiptNumber: order.mpesaReceiptNumber,
        total: order.total / 100, // Convert back to KSh
        realTimeUpdate: false, // Flag to indicate this was from stored data
      });
    } catch (error: any) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ error: "Failed to fetch payment status" });
    }
  });

  // Resend STK Push
  app.post("/api/payments/mpesa/resend", async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!mpesaService.isConfigured()) {
        return res.status(500).json({ 
          error: "Mpesa payment is not configured. Please contact support." 
        });
      }

      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Only allow resend for failed or initiated status
      if (!['failed', 'initiated'].includes(order.mpesaStatus || '')) {
        return res.status(400).json({ 
          error: `Cannot resend payment for order with status: ${order.mpesaStatus}` 
        });
      }

      if (!order.mpesaPhone) {
        return res.status(400).json({ 
          error: "No phone number found for this order. Please initiate payment first." 
        });
      }

      // Convert amount from cents to KES for Mpesa
      const amount = order.total / 100;

      // Initiate STK Push
      const stkResult = await mpesaService.initiateSTKPush({
        phone: order.mpesaPhone,
        amount,
        orderId: order.id,
        accountReference: `KARY-${order.id.substring(0, 8)}`,
        transactionDesc: `Payment for Kary Perfumes order ${order.id.substring(0, 8)} (resend)`,
      });

      // Create new payment record for resend attempt
      await storage.createPayment({
        orderId: order.id,
        paymentMethod: 'mpesa',
        amount: order.total, // Keep in cents for consistency
        currency: 'KES',
        status: 'pending',
        mpesaMerchantRequestId: stkResult.merchantRequestID,
        mpesaCheckoutRequestId: stkResult.checkoutRequestID,
        mpesaPhone: order.mpesaPhone,
        initiatedAt: new Date(),
        retryCount: (order.paymentRetryCount || 0) + 1,
      });

      // Update order with new Mpesa details and increment retry count
      await storage.updateOrderMpesaDetails(order.id, {
        mpesaMerchantRequestId: stkResult.merchantRequestID,
        mpesaCheckoutRequestId: stkResult.checkoutRequestID,
        mpesaStatus: 'initiated',
        paymentMethod: 'mpesa',
      });
      
      // Increment payment retry count
      await storage.incrementPaymentRetryCount(order.id);

      console.log(`STK Push resent for order ${order.id}:`, {
        merchantRequestID: stkResult.merchantRequestID,
        checkoutRequestID: stkResult.checkoutRequestID,
        customerMessage: stkResult.customerMessage,
      });

      res.json({
        success: true,
        checkoutRequestID: stkResult.checkoutRequestID,
        merchantRequestID: stkResult.merchantRequestID,
        customerMessage: stkResult.customerMessage,
      });
    } catch (error: any) {
      console.error("Error resending Mpesa payment:", error);
      res.status(500).json({ 
        error: "Failed to resend payment", 
        details: error.message 
      });
    }
  });

  // Cancel payment
  app.post("/api/payments/mpesa/cancel", async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Only allow cancellation of initiated/failed payments
      if (!['initiated', 'failed'].includes(order.mpesaStatus || '')) {
        return res.status(400).json({ 
          error: `Cannot cancel payment for order with status: ${order.mpesaStatus}` 
        });
      }

      // Mark payment as cancelled
      await storage.updateOrderMpesaDetails(order.id, {
        mpesaStatus: 'cancelled' as any,
      });

      console.log(`Payment cancelled for order ${order.id}`);

      res.json({
        success: true,
        message: "Payment cancelled successfully"
      });
    } catch (error: any) {
      console.error("Error cancelling Mpesa payment:", error);
      res.status(500).json({ 
        error: "Failed to cancel payment", 
        details: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
