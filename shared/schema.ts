import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, json, unique } from "drizzle-orm/pg-core";
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
  
  // Enhanced payment tracking fields
  paymentMethod: text("payment_method"), // 'stripe' | 'mpesa'
  currency: text("currency").notNull().default("KES"), // Explicit currency tracking
  paymentInitiatedAt: timestamp("payment_initiated_at"), // When payment process started
  paidAt: timestamp("paid_at"), // When payment was completed
  paymentFailureReason: text("payment_failure_reason"), // Detailed failure reasons
  paymentRetryCount: integer("payment_retry_count").default(0), // Number of payment attempts
  paymentProcessingFee: integer("payment_processing_fee"), // Gateway fees in cents
  paymentGatewayResponse: json("payment_gateway_response"), // Full gateway response for audit
  
  // Stripe payment fields
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  
  // M-Pesa payment fields
  mpesaMerchantRequestId: text("mpesa_merchant_request_id"),
  mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  mpesaStatus: text("mpesa_status"), // 'initiated' | 'pending' | 'paid' | 'failed' | 'cancelled'
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

// Payments table - Dedicated table for tracking all payment transactions
export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  
  // Core payment information
  paymentMethod: text("payment_method").notNull(), // 'stripe' | 'mpesa'
  amount: integer("amount").notNull(), // Amount in cents
  currency: text("currency").notNull().default("KES"),
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded'
  
  // Transaction identifiers
  transactionId: text("transaction_id"), // Stripe payment intent ID or M-Pesa transaction ID
  receiptNumber: text("receipt_number"), // M-Pesa receipt number or Stripe charge ID
  
  // Payment gateway specific fields
  gatewayResponse: json("gateway_response"), // Full response from payment gateway
  processingFee: integer("processing_fee"), // Gateway processing fees in cents
  
  // Stripe specific fields
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  
  // M-Pesa specific fields
  mpesaMerchantRequestId: text("mpesa_merchant_request_id"),
  mpesaCheckoutRequestId: text("mpesa_checkout_request_id"),
  mpesaReceiptNumber: text("mpesa_receipt_number"),
  mpesaPhone: text("mpesa_phone"), // E.164 normalized phone
  
  // Payment lifecycle tracking
  initiatedAt: timestamp("initiated_at"), // When payment process started
  processedAt: timestamp("processed_at"), // When payment was processed by gateway
  completedAt: timestamp("completed_at"), // When payment was confirmed completed
  failedAt: timestamp("failed_at"), // When payment failed
  
  // Error tracking
  failureReason: text("failure_reason"), // Human readable failure reason
  failureCode: text("failure_code"), // Gateway specific failure code
  retryCount: integer("retry_count").default(0), // Number of retry attempts
  
  // Audit fields
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    orderIdIdx: index("payments_order_id_idx").on(table.orderId),
    statusIdx: index("payments_status_idx").on(table.status),
    paymentMethodIdx: index("payments_method_idx").on(table.paymentMethod),
    transactionIdIdx: index("payments_transaction_id_idx").on(table.transactionId),
    mpesaCheckoutIdx: index("payments_mpesa_checkout_idx").on(table.mpesaCheckoutRequestId),
    createdAtIdx: index("payments_created_at_idx").on(table.createdAt),
    // Unique constraints for idempotency
    transactionIdUnique: unique("payments_transaction_id_unique").on(table.transactionId),
    mpesaCheckoutUnique: unique("payments_mpesa_checkout_unique").on(table.mpesaCheckoutRequestId),
    stripePaymentIntentUnique: unique("payments_stripe_pi_unique").on(table.stripePaymentIntentId),
  };
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
  paymentInitiatedAt: true,
  paymentFailureReason: true,
  paymentRetryCount: true,
  paymentProcessingFee: true,
  paymentGatewayResponse: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  status: true,
  createdAt: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updatePaymentSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled", "refunded"]).optional(),
  transactionId: z.string().optional(),
  receiptNumber: z.string().optional(),
  gatewayResponse: z.any().optional(),
  processingFee: z.number().optional(),
  stripePaymentIntentId: z.string().optional(),
  stripeChargeId: z.string().optional(),
  mpesaMerchantRequestId: z.string().optional(),
  mpesaCheckoutRequestId: z.string().optional(),
  mpesaReceiptNumber: z.string().optional(),
  mpesaPhone: z.string().optional(),
  initiatedAt: z.date().optional(),
  processedAt: z.date().optional(),
  completedAt: z.date().optional(),
  failedAt: z.date().optional(),
  failureReason: z.string().optional(),
  failureCode: z.string().optional(),
  retryCount: z.number().optional(),
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
  mpesaStatus: z.enum(["initiated", "pending", "paid", "failed", "cancelled"]).optional(),
  mpesaPhone: z.string().optional(),
  paymentMethod: z.enum(["stripe", "mpesa"]).optional(),
  paidAt: z.date().optional(),
});

// Stripe payment confirmation schema
export const stripeConfirmPaymentSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  paymentIntentId: z.string().min(1, "Payment Intent ID is required"),
});

// Enhanced payment update schema with comprehensive payment tracking
export const updateOrderPaymentSchema = z.object({
  // Core payment fields
  paymentMethod: z.enum(["stripe", "mpesa"]).optional(),
  currency: z.string().optional(),
  paymentInitiatedAt: z.date().optional(),
  paidAt: z.date().optional(),
  paymentFailureReason: z.string().optional(),
  paymentRetryCount: z.number().optional(),
  paymentProcessingFee: z.number().optional(),
  paymentGatewayResponse: z.any().optional(), // JSON object
  
  // Stripe specific fields
  stripePaymentIntentId: z.string().optional(),
  
  // M-Pesa specific fields
  mpesaMerchantRequestId: z.string().optional(),
  mpesaCheckoutRequestId: z.string().optional(),
  mpesaReceiptNumber: z.string().optional(),
  mpesaStatus: z.enum(["initiated", "pending", "paid", "failed", "cancelled"]).optional(),
  mpesaPhone: z.string().optional(),
});

// Payment initiation schema for recording when payment process starts
export const paymentInitiationSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.enum(["stripe", "mpesa"]),
  currency: z.string().default("KES"),
  initiatedAt: z.date().default(() => new Date()),
  retryCount: z.number().default(0),
});

// Payment completion schema for successful payments
export const paymentCompletionSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.enum(["stripe", "mpesa"]),
  transactionId: z.string(), // Receipt number or payment intent ID
  amount: z.number(), // Amount paid in cents
  currency: z.string(),
  completedAt: z.date(),
  processingFee: z.number().optional(),
  gatewayResponse: z.any().optional(),
});

// Payment failure schema for failed payments
export const paymentFailureSchema = z.object({
  orderId: z.string(),
  paymentMethod: z.enum(["stripe", "mpesa"]),
  failureReason: z.string(),
  failureCode: z.string().optional(),
  failedAt: z.date().default(() => new Date()),
  retryCount: z.number(),
  gatewayResponse: z.any().optional(),
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
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePayment = z.infer<typeof updatePaymentSchema>;
export type AdminSession = typeof adminSessions.$inferSelect;
export type InsertAdminSession = z.infer<typeof insertAdminSessionSchema>;
export type AdminLoginData = z.infer<typeof adminLoginSchema>;
export type UpdateReviewStatus = z.infer<typeof updateReviewStatusSchema>;
export type UpdateOrderMpesa = z.infer<typeof updateOrderMpesaSchema>;
export type StripeConfirmPayment = z.infer<typeof stripeConfirmPaymentSchema>;
export type UpdateOrderPayment = z.infer<typeof updateOrderPaymentSchema>;

// Enhanced payment tracking types
export type PaymentInitiation = z.infer<typeof paymentInitiationSchema>;
export type PaymentCompletion = z.infer<typeof paymentCompletionSchema>;
export type PaymentFailure = z.infer<typeof paymentFailureSchema>;
