import { Resend } from 'resend';
import type { Order, OrderItem, Product } from '@shared/schema';

// Initialize Resend client
let resendClient: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY not found in environment variables. Email functionality will be disabled.');
}

export interface EmailOrderItem extends OrderItem {
  product?: Product;
}

export interface OrderReceiptData {
  order: Order;
  items: EmailOrderItem[];
}

// Generate HTML email template for order receipt
function generateOrderReceiptHTML(data: OrderReceiptData): string {
  const { order, items } = data;
  
  // Format dates
  const orderDate = order.createdAt ? order.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) : 'Date not available';
  
  const paidDate = order.paidAt ? order.paidAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }) : null;

  // Format payment method display
  const paymentMethodDisplay = order.paymentMethod === 'mpesa' ? 'M-Pesa' : 
                              order.paymentMethod === 'stripe' ? 'Credit Card' : 
                              'Unknown';

  // Calculate totals (convert from cents)
  const subtotal = order.subtotal / 100;
  const deliveryCharge = order.deliveryCharge / 100;
  const total = order.total / 100;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Receipt - ${order.id}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .email-container {
            background-color: #ffffff;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .header h1 {
            color: #2c3e50;
            margin: 0 0 10px 0;
            font-size: 28px;
        }
        .header p {
            color: #6c757d;
            margin: 0;
            font-size: 16px;
        }
        .status-badge {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 6px 16px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
            margin: 15px 0;
        }
        .order-info {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 25px;
        }
        .order-info h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 18px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .info-label {
            font-weight: 500;
            color: #495057;
        }
        .info-value {
            color: #6c757d;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 25px;
        }
        .items-table th {
            background-color: #e9ecef;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            color: #495057;
            border-bottom: 2px solid #dee2e6;
        }
        .items-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
        }
        .item-name {
            font-weight: 500;
            color: #2c3e50;
        }
        .price {
            font-weight: 500;
        }
        .totals-section {
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 25px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .total-row.final {
            font-weight: 700;
            font-size: 18px;
            color: #2c3e50;
            border-top: 2px solid #dee2e6;
            padding-top: 12px;
            margin-top: 12px;
        }
        .customer-info {
            margin-bottom: 25px;
        }
        .customer-info h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 18px;
        }
        .footer {
            text-align: center;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            color: #6c757d;
            font-size: 14px;
        }
        .receipt-number {
            background-color: #e8f4fd;
            color: #0066cc;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: monospace;
            font-weight: bold;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-container {
                padding: 20px;
            }
            .items-table {
                font-size: 14px;
            }
            .items-table th,
            .items-table td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Order Confirmation</h1>
            <p>Thank you for your purchase!</p>
            <div class="status-badge">Payment Confirmed</div>
        </div>

        <div class="order-info">
            <h3>Order Details</h3>
            <div class="info-row">
                <span class="info-label">Order Number:</span>
                <span class="info-value"><strong>${order.id}</strong></span>
            </div>
            <div class="info-row">
                <span class="info-label">Order Date:</span>
                <span class="info-value">${orderDate}</span>
            </div>
            ${paidDate ? `
            <div class="info-row">
                <span class="info-label">Payment Date:</span>
                <span class="info-value">${paidDate}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Payment Method:</span>
                <span class="info-value">${paymentMethodDisplay}</span>
            </div>
            ${order.mpesaReceiptNumber ? `
            <div class="info-row">
                <span class="info-label">M-Pesa Receipt:</span>
                <span class="info-value receipt-number">${order.mpesaReceiptNumber}</span>
            </div>
            ` : ''}
        </div>

        <div class="customer-info">
            <h3>Customer & Delivery Information</h3>
            <div class="info-row">
                <span class="info-label">Customer Name:</span>
                <span class="info-value">${order.customerName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Phone:</span>
                <span class="info-value">${order.customerPhone}</span>
            </div>
            ${order.customerEmail ? `
            <div class="info-row">
                <span class="info-label">Email:</span>
                <span class="info-value">${order.customerEmail}</span>
            </div>
            ` : ''}
            <div class="info-row">
                <span class="info-label">Delivery Address:</span>
                <span class="info-value">${order.deliveryAddress}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Delivery Location:</span>
                <span class="info-value">${order.deliveryLocation === 'nairobi-cbd' ? 'Nairobi CBD' : 'Other Location'}</span>
            </div>
        </div>

        <h3>Order Items</h3>
        <table class="items-table">
            <thead>
                <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${items.map(item => `
                <tr>
                    <td class="item-name">${item.productName}</td>
                    <td>${item.quantity}</td>
                    <td class="price">KSh ${(item.productPrice / 100).toLocaleString()}</td>
                    <td class="price">KSh ${((item.productPrice * item.quantity) / 100).toLocaleString()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="totals-section">
            <div class="total-row">
                <span>Subtotal:</span>
                <span>KSh ${subtotal.toLocaleString()}</span>
            </div>
            <div class="total-row">
                <span>Delivery Charge:</span>
                <span>KSh ${deliveryCharge.toLocaleString()}</span>
            </div>
            <div class="total-row final">
                <span>Total Amount:</span>
                <span>KSh ${total.toLocaleString()}</span>
            </div>
        </div>

        <div class="footer">
            <p><strong>Thank you for shopping with us!</strong></p>
            <p>Your order is being processed and will be delivered to your specified address.</p>
            <p>If you have any questions about your order, please contact our customer service.</p>
        </div>
    </div>
</body>
</html>
  `.trim();
}

// Send order receipt email
export async function sendOrderReceiptEmail(data: OrderReceiptData): Promise<boolean> {
  if (!resendClient) {
    console.error('Resend client not initialized. Cannot send email.');
    return false;
  }

  if (!data.order.customerEmail) {
    console.log(`Order ${data.order.id} has no customer email. Skipping email send.`);
    return false;
  }

  try {
    console.log(`Attempting to send order receipt email for order ${data.order.id} to ${data.order.customerEmail}`);
    
    const result = await resendClient.emails.send({
      from: 'Acme <onboarding@resend.dev>',
      to: [data.order.customerEmail],
      subject: `Order Receipt #${data.order.id} - Thank you for your purchase!`,
      html: generateOrderReceiptHTML(data),
    });

    console.log(`Email sent successfully for order ${data.order.id}:`, {
      emailId: result.data?.id,
      recipient: data.order.customerEmail,
      orderId: data.order.id,
      total: data.order.total / 100
    });

    return true;
  } catch (error) {
    console.error(`Failed to send order receipt email for order ${data.order.id}:`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      recipient: data.order.customerEmail,
      orderId: data.order.id
    });

    return false;
  }
}

// Check if email service is configured
export function isEmailServiceConfigured(): boolean {
  return resendClient !== null && !!process.env.RESEND_API_KEY;
}

// Get email service status
export function getEmailServiceStatus(): { configured: boolean; apiKeyPresent: boolean } {
  return {
    configured: isEmailServiceConfigured(),
    apiKeyPresent: !!process.env.RESEND_API_KEY
  };
}