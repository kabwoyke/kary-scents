import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Products table
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // Price in cents (Ksh)
  originalPrice: integer("original_price"), // Original price for discounts
  image: text("image").notNull(),
  category: text("category").notNull(),
  isNew: boolean("is_new").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders table
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLocation: text("delivery_location").notNull(), // 'nairobi-cbd' or 'other'
  deliveryCharge: integer("delivery_charge").notNull(),
  subtotal: integer("subtotal").notNull(),
  total: integer("total").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, shipped, delivered
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  // Mpesa payment fields
  paymentMethod: text("payment_method"), // 'stripe' | 'mpesa'
  paidAt: timestamp("paid_at"),
  mpesaMerchantRequestId: text("mpesa_merchant_request_id"),
  mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  mpesaStatus: text("mpesa_status"), // 'initiated' | 'pending' | 'paid' | 'failed'
  mpesaPhone: text("mpesa_phone"), // E.164 normalized phone
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items table
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id),
  productName: text("product_name").notNull(), // Store snapshot in case product changes
  productPrice: integer("product_price").notNull(),
  quantity: integer("quantity").notNull(),
});

// Reviews table
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1-5
  content: text("content").notNull(),
  customerName: text("customer_name"),
  customerPhoneHash: text("customer_phone_hash"),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "set null" }),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    productStatusIdx: index("reviews_product_status_idx").on(table.productId, table.status),
    orderIdx: index("reviews_order_idx").on(table.orderId),
  };
});

// Admin sessions table
export const adminSessions = pgTable("admin_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Zod schemas
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  stripePaymentIntentId: true,
  paidAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  status: true,
  createdAt: true,
});

// Admin schemas
export const adminLoginSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

export const insertAdminSessionSchema = createInsertSchema(adminSessions).omit({
  id: true,
  createdAt: true,
});

// Review status update schema
export const updateReviewStatusSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

// Mpesa update schemas
export const updateOrderMpesaSchema = z.object({
  mpesaMerchantRequestId: z.string().optional(),
  mpesaCheckoutRequestId: z.string().optional(),
  mpesaReceiptNumber: z.string().optional(),
  mpesaStatus: z.enum(["initiated", "pending", "paid", "failed"]).optional(),
  mpesaPhone: z.string().optional(),
  paymentMethod: z.enum(["stripe", "mpesa"]).optional(),
  paidAt: z.date().optional(),
});

// Stripe payment confirmation schema
export const stripeConfirmPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  paymentIntentId: z.string().min(1, "Payment Intent ID is required"),
});

// Generic payment update schema (replaces M-Pesa specific one for general use)
export const updateOrderPaymentSchema = z.object({
  paymentMethod: z.enum(["stripe", "mpesa"]).optional(),
  paidAt: z.date().optional(),
  stripePaymentIntentId: z.string().optional(),
  // M-Pesa specific fields
  mpesaMerchantRequestId: z.string().optional(),
  mpesaCheckoutRequestId: z.string().optional(),
  mpesaReceiptNumber: z.string().optional(),
  mpesaStatus: z.enum(["initiated", "pending", "paid", "failed"]).optional(),
  mpesaPhone: z.string().optional(),
});

// Types
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type AdminLoginData = z.infer<typeof adminLoginSchema>;
export type UpdateReviewStatus = z.infer<typeof updateReviewStatusSchema>;
export type UpdateOrderMpesa = z.infer<typeof updateOrderMpesaSchema>;
export type StripeConfirmPayment = z.infer<typeof stripeConfirmPaymentSchema>;
export type UpdateOrderPayment = z.infer<typeof updateOrderPaymentSchema>;
