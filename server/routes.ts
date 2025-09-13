import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertOrderSchema, adminLoginSchema, insertReviewSchema, updateReviewStatusSchema, stripeConfirmPaymentSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";
import crypto from "crypto";
import { mpesaService } from "./mpesa";
import { sendOrderReceiptEmail, getEmailServiceStatus } from "./email";

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

  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      // Convert prices from cents to KSh for frontend
      const productsWithPrices = products.map(product => ({
        ...product,
        price: product.price / 100,
        originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
      }));
      res.json(productsWithPrices);
    } catch (error) {
      console.error("Error fetching products:", error);
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

  // Admin Products endpoint (distinct from public products)
  app.get("/api/admin/products", requireAdminAuth, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      // Convert prices from cents to KSh for frontend
      const productsWithPrices = products.map(product => ({
        ...product,
        price: product.price / 100,
        originalPrice: product.originalPrice ? product.originalPrice / 100 : undefined,
      }));
      res.json(productsWithPrices);
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
      
      let result;
      if (status) {
        result = await storage.getOrdersByStatus(status, limit, offset);
      } else {
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

  app.get("/api/admin/stats", requireAdminAuth, async (req, res) => {
    try {
      const stats = await storage.getAdminStats();
      
      // Convert revenue from cents to KSh for frontend
      const statsWithPrice = {
        ...stats,
        totalRevenue: stats.totalRevenue / 100
      };
      
      res.json(statsWithPrice);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Stripe payment routes (using blueprint pattern)
  app.post("/api/create-payment-intent", async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: "Payment processing not configured. Missing Stripe keys." });
    }

    try {
      const { amount } = req.body; // Amount in KSh
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "kes", // Kenyan Shilling
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

  // Rate limiting for payment initiation (in-memory store for simplicity)
  const paymentAttempts = new Map<string, { count: number; resetTime: number }>();
  const PAYMENT_RATE_LIMIT = 3; // Max 3 attempts per 10 minutes per IP
  const PAYMENT_RATE_WINDOW = 10 * 60 * 1000; // 10 minutes

  function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const attempts = paymentAttempts.get(ip) || { count: 0, resetTime: now + PAYMENT_RATE_WINDOW };
    
    // Reset if window expired
    if (now > attempts.resetTime) {
      attempts.count = 0;
      attempts.resetTime = now + PAYMENT_RATE_WINDOW;
    }
    
    if (attempts.count >= PAYMENT_RATE_LIMIT) {
      return { allowed: false, remaining: 0, resetTime: attempts.resetTime };
    }
    
    attempts.count++;
    paymentAttempts.set(ip, attempts);
    
    return { 
      allowed: true, 
      remaining: PAYMENT_RATE_LIMIT - attempts.count, 
      resetTime: attempts.resetTime 
    };
  }

  // Mpesa Payment Routes
  app.post("/api/payments/mpesa/initiate", async (req, res) => {
    try {
      const { orderId, phone } = req.body;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      // Check rate limiting
      const rateLimit = checkRateLimit(clientIp);
      if (!rateLimit.allowed) {
        const resetTime = new Date(rateLimit.resetTime);
        return res.status(429).json({ 
          error: "Too many payment attempts. Please try again later.",
          resetTime: resetTime.toISOString(),
          remainingAttempts: 0
        });
      }

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

      // Record payment initiation with comprehensive tracking
      await storage.recordPaymentInitiation(order.id, {
        orderId: order.id,
        paymentMethod: 'mpesa',
        currency: 'KES',
        initiatedAt: new Date(),
        retryCount: order.paymentRetryCount || 0,
      });

      // Increment retry count if this is a retry
      if (order.paymentInitiatedAt) {
        await storage.incrementPaymentRetryCount(order.id);
      }

      // Initiate STK Push
      const stkResult = await mpesaService.initiateSTKPush({
        phone: normalizedPhone,
        amount,
        orderId: order.id,
        accountReference: `KARY-${order.id.substring(0, 8)}`,
        transactionDesc: `Payment for KARY SCENTS order ${order.id.substring(0, 8)}`,
      });

      // Update order with Mpesa details
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

      // Idempotent processing - only allow certain status transitions
      if (order.mpesaStatus === 'paid') {
        console.log("Order already processed as paid:", order.id);
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
          
          await storage.updateOrderMpesaDetails(order.id, {
            mpesaStatus: 'failed',
            mpesaReceiptNumber: callbackDetails.mpesaReceiptNumber || undefined,
          });
          
          callbackProcessed = true;
          return res.json({ status: "OK", message: "Amount mismatch - marked as failed" });
        }
      }

      // Update order based on payment result
      if (callbackDetails.resultCode === 0) {
        // Payment successful
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

        // Send order receipt email
        try {
          const orderWithItems = await storage.getOrderWithItems(order.id);
          if (orderWithItems) {
            const emailSent = await sendOrderReceiptEmail({
              order: orderWithItems.order,
              items: orderWithItems.items
            });
            
            if (emailSent) {
              console.log(`Order receipt email sent successfully for order ${order.id}`);
            } else {
              console.warn(`Failed to send order receipt email for order ${order.id}`);
            }
          }
        } catch (emailError) {
          console.error(`Error sending order receipt email for order ${order.id}:`, {
            error: emailError instanceof Error ? emailError.message : 'Unknown error',
            orderId: order.id
          });
          // Don't fail the payment processing if email fails
        }
      } else {
        // Payment failed
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

      res.json({
        orderId: order.id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        mpesaStatus: order.mpesaStatus,
        paidAt: order.paidAt,
        mpesaReceiptNumber: order.mpesaReceiptNumber,
        total: order.total / 100, // Convert back to KSh
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
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

      // Check rate limiting (stricter for resend)
      const rateLimit = checkRateLimit(clientIp);
      if (!rateLimit.allowed) {
        const resetTime = new Date(rateLimit.resetTime);
        return res.status(429).json({ 
          error: "Too many payment attempts. Please wait before trying again.",
          resetTime: resetTime.toISOString()
        });
      }

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
        transactionDesc: `Payment for KARY SCENTS order ${order.id.substring(0, 8)} (resend)`,
      });

      // Update order with new Mpesa details
      await storage.updateOrderMpesaDetails(order.id, {
        mpesaMerchantRequestId: stkResult.merchantRequestID,
        mpesaCheckoutRequestId: stkResult.checkoutRequestID,
        mpesaStatus: 'initiated',
        paymentMethod: 'mpesa',
      });

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
        remainingAttempts: rateLimit.remaining - 1,
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
        mpesaStatus: 'failed',
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
