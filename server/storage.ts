import { 
  type Product, 
  type InsertProduct, 
  type Order, 
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type Review,
  type InsertReview,
  type UpdateReviewStatus,
  type UpdateOrderMpesa,
  type UpdateOrderPayment,
  type PaymentInitiation,
  type PaymentCompletion,
  type PaymentFailure,
  type Payment,
  type InsertPayment,
  type UpdatePayment,
  type AdminSession,
  type InsertAdminSession,
  products,
  orders,
  orderItems,
  reviews,
  payments,
  adminSessions
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, count, sum, gte, lt, avg, and, sql } from "drizzle-orm";

export interface IStorage {
  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;
  
  // Orders
  createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderWithItems(id: string): Promise<{ order: Order; items: OrderItem[] } | undefined>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  updateOrderPaymentIntent(id: string, paymentIntentId: string): Promise<Order | undefined>;
  updateOrderPayment(id: string, updates: UpdateOrderPayment): Promise<Order | undefined>;
  
  // Admin Orders Management
  getAllOrders(limit?: number, offset?: number): Promise<{ orders: Order[]; total: number }>;
  getOrdersByStatus(status: string, limit?: number, offset?: number): Promise<{ orders: Order[]; total: number }>;
  
  // Admin Sessions
  createAdminSession(session: InsertAdminSession): Promise<AdminSession>;
  getAdminSession(sessionId: string): Promise<AdminSession | undefined>;
  deleteAdminSession(sessionId: string): Promise<boolean>;
  deleteExpiredAdminSessions(): Promise<number>;
  
  // Admin Stats
  getAdminStats(): Promise<{
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    recentOrdersCount: number;
  }>;
  
  // Reviews
  createReview(review: InsertReview): Promise<Review>;
  getProductReviews(productId: string, status?: string): Promise<Review[]>;
  getReviewById(id: string): Promise<Review | undefined>;
  updateReviewStatus(id: string, status: UpdateReviewStatus): Promise<Review | undefined>;
  getAllPendingReviews(limit?: number, offset?: number): Promise<{ reviews: Review[]; total: number }>;
  getAllReviews(status?: string, limit?: number, offset?: number): Promise<{ reviews: Review[]; total: number }>;
  getProductAverageRating(productId: string): Promise<number>;
  
  // Payments
  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentsByOrder(orderId: string): Promise<Payment[]>;
  getPaymentByTransactionId(transactionId: string): Promise<Payment | undefined>;
  getPaymentByMpesaCheckoutId(checkoutRequestId: string): Promise<Payment | undefined>;
  updatePayment(id: string, updates: UpdatePayment): Promise<Payment | undefined>;
  getAllPayments(limit?: number, offset?: number): Promise<{ payments: Payment[]; total: number }>;
  getPaymentsByStatus(status: string, limit?: number, offset?: number): Promise<{ payments: Payment[]; total: number }>;
  getPaymentsByMethod(method: 'stripe' | 'mpesa', limit?: number, offset?: number): Promise<{ payments: Payment[]; total: number }>;
  getPaymentAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalRevenue: number;
    averageProcessingFee: number;
    paymentMethodBreakdown: { stripe: number; mpesa: number; };
    statusBreakdown: { [status: string]: number; };
  }>;
  
  // Mpesa Orders
  updateOrderMpesaDetails(id: string, updates: UpdateOrderMpesa): Promise<Order | undefined>;
  getOrderByCheckoutRequestId(checkoutRequestId: string): Promise<Order | undefined>;
  
  // Enhanced Payment Tracking
  recordPaymentInitiation(orderId: string, data: PaymentInitiation): Promise<Order | undefined>;
  recordPaymentCompletion(orderId: string, data: PaymentCompletion): Promise<Order | undefined>;
  recordPaymentFailure(orderId: string, data: PaymentFailure): Promise<Order | undefined>;
  incrementPaymentRetryCount(orderId: string): Promise<Order | undefined>;
  getPaymentHistory(orderId: string): Promise<Order | undefined>;
  getOrdersByPaymentMethod(method: 'stripe' | 'mpesa', limit?: number): Promise<Order[]>;
  getFailedPayments(limit?: number): Promise<Order[]>;
}

export class DatabaseStorage implements IStorage {
  // Products
  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const result = await db.select().from(products).where(eq(products.id, id));
    return result[0];
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await db.insert(products).values(product).returning();
    return result[0];
  }

  async updateProduct(id: string, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return result[0];
  }

  async deleteProduct(id: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result as any).rowCount > 0;
  }

  // Orders
  async createOrder(order: InsertOrder, items: InsertOrderItem[]): Promise<Order> {
    return await db.transaction(async (tx) => {
      // Create order
      const [newOrder] = await tx.insert(orders).values(order).returning();
      
      // Create order items
      const orderItemsWithOrderId = items.map(item => ({
        ...item,
        orderId: newOrder.id
      }));
      
      await tx.insert(orderItems).values(orderItemsWithOrderId);
      
      return newOrder;
    });
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const result = await db.select().from(orders).where(eq(orders.id, id));
    return result[0];
  }

  async getOrderWithItems(id: string): Promise<{ order: Order; items: OrderItem[] } | undefined> {
    const order = await this.getOrder(id);
    if (!order) return undefined;
    
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
    return { order, items };
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async updateOrderPaymentIntent(id: string, paymentIntentId: string): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ stripePaymentIntentId: paymentIntentId, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async updateOrderPayment(id: string, updates: UpdateOrderPayment): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  // Admin Orders Management
  async getAllOrders(limit: number = 50, offset: number = 0): Promise<{ orders: Order[]; total: number }> {
    const [ordersResult, totalResult] = await Promise.all([
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(orders)
    ]);
    
    return {
      orders: ordersResult,
      total: totalResult[0].count
    };
  }

  async getOrdersByStatus(status: string, limit: number = 50, offset: number = 0): Promise<{ orders: Order[]; total: number }> {
    const [ordersResult, totalResult] = await Promise.all([
      db.select().from(orders).where(eq(orders.status, status)).orderBy(desc(orders.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(orders).where(eq(orders.status, status))
    ]);
    
    return {
      orders: ordersResult,
      total: totalResult[0].count
    };
  }

  // Admin Sessions
  async createAdminSession(session: InsertAdminSession): Promise<AdminSession> {
    const result = await db.insert(adminSessions).values(session).returning();
    return result[0];
  }

  async getAdminSession(sessionId: string): Promise<AdminSession | undefined> {
    const result = await db
      .select()
      .from(adminSessions)
      .where(eq(adminSessions.sessionId, sessionId));
    return result[0];
  }

  async deleteAdminSession(sessionId: string): Promise<boolean> {
    const result = await db
      .delete(adminSessions)
      .where(eq(adminSessions.sessionId, sessionId));
    return (result as any).rowCount > 0;
  }

  async deleteExpiredAdminSessions(): Promise<number> {
    const now = new Date();
    const result = await db
      .delete(adminSessions)
      .where(lt(adminSessions.expiresAt, now));
    return (result as any).rowCount || 0;
  }

  // Admin Stats
  async getAdminStats(): Promise<{
    totalProducts: number;
    totalOrders: number;
    totalRevenue: number;
    recentOrdersCount: number;
  }> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [productsCount, ordersCount, revenueSum, recentOrdersCount] = await Promise.all([
      db.select({ count: count() }).from(products),
      db.select({ count: count() }).from(orders),
      db.select({ total: sum(orders.total) }).from(orders),
      db.select({ count: count() }).from(orders).where(gte(orders.createdAt, sevenDaysAgo))
    ]);

    return {
      totalProducts: productsCount[0].count,
      totalOrders: ordersCount[0].count,
      totalRevenue: Number(revenueSum[0].total) || 0,
      recentOrdersCount: recentOrdersCount[0].count
    };
  }

  // Reviews
  async createReview(review: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(review).returning();
    return result[0];
  }

  async getProductReviews(productId: string, status?: string): Promise<Review[]> {
    if (status) {
      return await db.select().from(reviews)
        .where(and(
          eq(reviews.productId, productId),
          eq(reviews.status, status as any)
        ))
        .orderBy(desc(reviews.createdAt));
    }
    
    return await db.select().from(reviews)
      .where(eq(reviews.productId, productId))
      .orderBy(desc(reviews.createdAt));
  }

  async getReviewById(id: string): Promise<Review | undefined> {
    const result = await db.select().from(reviews).where(eq(reviews.id, id));
    return result[0];
  }

  async updateReviewStatus(id: string, status: UpdateReviewStatus): Promise<Review | undefined> {
    console.log("Updating review status in database:", {
      reviewId: id,
      statusUpdate: status
    });
    
    try {
      const result = await db
        .update(reviews)
        .set(status)
        .where(eq(reviews.id, id))
        .returning();
      
      console.log("Database update result:", {
        rowsAffected: result.length,
        updatedReview: result[0]
      });
      
      return result[0];
    } catch (error) {
      console.error("Database error in updateReviewStatus:", error);
      throw error;
    }
  }

  async getAllPendingReviews(limit: number = 50, offset: number = 0): Promise<{ reviews: Review[]; total: number }> {
    const [reviewsResult, totalResult] = await Promise.all([
      db.select().from(reviews)
        .where(eq(reviews.status, "pending"))
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(reviews).where(eq(reviews.status, "pending"))
    ]);
    
    return {
      reviews: reviewsResult,
      total: totalResult[0].count
    };
  }

  async getAllReviews(status?: string, limit: number = 50, offset: number = 0): Promise<{ reviews: Review[]; total: number }> {
    if (status) {
      const [reviewsResult, totalResult] = await Promise.all([
        db.select().from(reviews)
          .where(eq(reviews.status, status as any))
          .orderBy(desc(reviews.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: count() }).from(reviews).where(eq(reviews.status, status as any))
      ]);
      
      return {
        reviews: reviewsResult,
        total: totalResult[0].count
      };
    }
    
    const [reviewsResult, totalResult] = await Promise.all([
      db.select().from(reviews)
        .orderBy(desc(reviews.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(reviews)
    ]);
    
    return {
      reviews: reviewsResult,
      total: totalResult[0].count
    };
  }

  async getProductAverageRating(productId: string): Promise<number> {
    const result = await db
      .select({ avgRating: avg(reviews.rating) })
      .from(reviews)
      .where(and(
        eq(reviews.productId, productId),
        eq(reviews.status, "approved")
      ));
    
    return Number(result[0].avgRating) || 0;
  }

  // Mpesa Orders
  async updateOrderMpesaDetails(id: string, updates: UpdateOrderMpesa): Promise<Order | undefined> {
    const result = await db
      .update(orders)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return result[0];
  }

  async getOrderByCheckoutRequestId(checkoutRequestId: string): Promise<Order | undefined> {
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.mpesaCheckoutRequestId, checkoutRequestId));
    return result[0];
  }

  // Enhanced Payment Tracking Methods
  async recordPaymentInitiation(orderId: string, data: PaymentInitiation): Promise<Order | undefined> {
    const updateData: Partial<UpdateOrderPayment> = {
      paymentMethod: data.paymentMethod,
      currency: data.currency,
      paymentInitiatedAt: data.initiatedAt,
      paymentRetryCount: data.retryCount,
    };

    const result = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    
    console.log(`Payment initiation recorded for order ${orderId}:`, {
      method: data.paymentMethod,
      currency: data.currency,
      retryCount: data.retryCount
    });
    
    return result[0];
  }

  async recordPaymentCompletion(orderId: string, data: PaymentCompletion): Promise<Order | undefined> {
    const updateData: Partial<UpdateOrderPayment> = {
      paymentMethod: data.paymentMethod,
      paidAt: data.completedAt,
      paymentProcessingFee: data.processingFee,
      paymentGatewayResponse: data.gatewayResponse,
    };

    // Set method-specific transaction ID
    if (data.paymentMethod === 'stripe') {
      updateData.stripePaymentIntentId = data.transactionId;
    } else if (data.paymentMethod === 'mpesa') {
      updateData.mpesaReceiptNumber = data.transactionId;
      updateData.mpesaStatus = 'paid';
    }

    const result = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    
    console.log(`Payment completion recorded for order ${orderId}:`, {
      method: data.paymentMethod,
      transactionId: data.transactionId,
      amount: data.amount,
      fee: data.processingFee
    });
    
    return result[0];
  }

  async recordPaymentFailure(orderId: string, data: PaymentFailure): Promise<Order | undefined> {
    const updateData: Partial<UpdateOrderPayment> = {
      paymentMethod: data.paymentMethod,
      paymentFailureReason: data.failureReason,
      paymentRetryCount: data.retryCount,
      paymentGatewayResponse: data.gatewayResponse,
    };

    // Set method-specific failure status
    if (data.paymentMethod === 'mpesa') {
      updateData.mpesaStatus = 'failed';
    }

    const result = await db
      .update(orders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(orders.id, orderId))
      .returning();
    
    console.log(`Payment failure recorded for order ${orderId}:`, {
      method: data.paymentMethod,
      reason: data.failureReason,
      retryCount: data.retryCount
    });
    
    return result[0];
  }

  async incrementPaymentRetryCount(orderId: string): Promise<Order | undefined> {
    // Get current retry count
    const currentOrder = await this.getOrder(orderId);
    if (!currentOrder) return undefined;

    const newRetryCount = (currentOrder.paymentRetryCount || 0) + 1;
    
    const result = await db
      .update(orders)
      .set({ 
        paymentRetryCount: newRetryCount,
        updatedAt: new Date() 
      })
      .where(eq(orders.id, orderId))
      .returning();
    
    console.log(`Payment retry count incremented for order ${orderId}: ${newRetryCount}`);
    
    return result[0];
  }

  async getPaymentHistory(orderId: string): Promise<Order | undefined> {
    const result = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));
    return result[0];
  }

  async getOrdersByPaymentMethod(method: 'stripe' | 'mpesa', limit: number = 50): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.paymentMethod, method))
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  async getFailedPayments(limit: number = 50): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.mpesaStatus, 'failed'))
      .orderBy(desc(orders.updatedAt))
      .limit(limit);
  }

  // Original payment analytics method removed - using new payments table version below

  // Payments
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(payment).returning();
    return result[0];
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.id, id));
    return result[0];
  }

  async getPaymentsByOrder(orderId: string): Promise<Payment[]> {
    return await db.select().from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));
  }

  async getPaymentByTransactionId(transactionId: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments)
      .where(eq(payments.transactionId, transactionId));
    return result[0];
  }

  async getPaymentByMpesaCheckoutId(checkoutRequestId: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments)
      .where(eq(payments.mpesaCheckoutRequestId, checkoutRequestId));
    return result[0];
  }

  async updatePayment(id: string, updates: UpdatePayment): Promise<Payment | undefined> {
    const result = await db
      .update(payments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return result[0];
  }

  async getAllPayments(limit = 50, offset = 0): Promise<{ payments: Payment[]; total: number }> {
    const [paymentsResult, totalResult] = await Promise.all([
      db.select().from(payments)
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(payments)
    ]);

    return {
      payments: paymentsResult,
      total: totalResult[0].count
    };
  }

  async getPaymentsByStatus(status: string, limit = 50, offset = 0): Promise<{ payments: Payment[]; total: number }> {
    const [paymentsResult, totalResult] = await Promise.all([
      db.select().from(payments)
        .where(eq(payments.status, status))
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(payments)
        .where(eq(payments.status, status))
    ]);

    return {
      payments: paymentsResult,
      total: totalResult[0].count
    };
  }

  async getPaymentsByMethod(method: 'stripe' | 'mpesa', limit = 50, offset = 0): Promise<{ payments: Payment[]; total: number }> {
    const [paymentsResult, totalResult] = await Promise.all([
      db.select().from(payments)
        .where(eq(payments.paymentMethod, method))
        .orderBy(desc(payments.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(payments)
        .where(eq(payments.paymentMethod, method))
    ]);

    return {
      payments: paymentsResult,
      total: totalResult[0].count
    };
  }

  async getPaymentAnalytics(startDate?: Date, endDate?: Date): Promise<{
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    totalRevenue: number;
    averageProcessingFee: number;
    paymentMethodBreakdown: { stripe: number; mpesa: number; };
    statusBreakdown: { [status: string]: number; };
  }> {
    let whereCondition = sql`true`;
    
    if (startDate && endDate) {
      whereCondition = and(
        gte(payments.createdAt, startDate),
        lt(payments.createdAt, endDate)
      ) || sql`true`;
    } else if (startDate) {
      whereCondition = gte(payments.createdAt, startDate);
    } else if (endDate) {
      whereCondition = lt(payments.createdAt, endDate);
    }

    const [
      totalPaymentsResult,
      successfulPaymentsResult,
      failedPaymentsResult,
      revenueResult,
      avgFeeResult,
      stripeCountResult,
      mpesaCountResult,
      statusBreakdownResult
    ] = await Promise.all([
      // Total payments
      db.select({ count: count() })
        .from(payments)
        .where(whereCondition),
      
      // Successful payments
      db.select({ count: count() })
        .from(payments)
        .where(and(
          whereCondition,
          eq(payments.status, 'completed')
        )),
      
      // Failed payments  
      db.select({ count: count() })
        .from(payments)
        .where(and(
          whereCondition,
          eq(payments.status, 'failed')
        )),
      
      // Total revenue from successful payments
      db.select({ total: sum(payments.amount) })
        .from(payments)
        .where(and(
          whereCondition || sql`true`,
          eq(payments.status, 'completed')
        )),
      
      // Average processing fee
      db.select({ avg: avg(payments.processingFee) })
        .from(payments)
        .where(and(
          whereCondition || sql`true`,
          sql`processing_fee IS NOT NULL`
        )),
      
      // Stripe payments count
      db.select({ count: count() })
        .from(payments)
        .where(and(
          whereCondition || sql`true`,
          eq(payments.paymentMethod, 'stripe')
        )),
      
      // M-Pesa payments count
      db.select({ count: count() })
        .from(payments)
        .where(and(
          whereCondition || sql`true`,
          eq(payments.paymentMethod, 'mpesa')
        )),

      // Status breakdown
      db.select({ 
        status: payments.status, 
        count: count() 
      })
        .from(payments)
        .where(whereCondition)
        .groupBy(payments.status)
    ]);

    // Convert status breakdown to object
    const statusBreakdown: { [status: string]: number } = {};
    statusBreakdownResult.forEach(item => {
      statusBreakdown[item.status] = item.count;
    });

    return {
      totalPayments: totalPaymentsResult[0].count,
      successfulPayments: successfulPaymentsResult[0].count,
      failedPayments: failedPaymentsResult[0].count,
      totalRevenue: Number(revenueResult[0].total) || 0,
      averageProcessingFee: Number(avgFeeResult[0].avg) || 0,
      paymentMethodBreakdown: {
        stripe: stripeCountResult[0].count,
        mpesa: mpesaCountResult[0].count,
      },
      statusBreakdown
    };
  }
}

export const storage = new DatabaseStorage();

