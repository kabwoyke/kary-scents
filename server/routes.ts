import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProductSchema, insertOrderSchema } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

// Initialize Stripe - will handle missing key in payment endpoints
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve generated images
  app.get("/api/images/generated_images/:filename", (req, res) => {
    const { filename } = req.params;
    const imagePath = `./attached_assets/generated_images/${filename}`;
    res.sendFile(imagePath, { root: process.cwd() });
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

  app.post("/api/products", async (req, res) => {
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

  app.put("/api/products/:id", async (req, res) => {
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

  app.delete("/api/products/:id", async (req, res) => {
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

  // Order routes
  app.post("/api/orders", async (req, res) => {
    try {
      const { order, items } = req.body;
      
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

  const httpServer = createServer(app);
  return httpServer;
}
