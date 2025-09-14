# M-Pesa STK Push Integration Setup Guide

This document provides step-by-step instructions for setting up the M-Pesa STK Push payment integration for Kary Perfumes.

## 🚀 Quick Start

The M-Pesa integration has been fully implemented and is ready for production use. Follow these steps to configure it:

## 📋 Prerequisites

1. **Safaricom Daraja Account**: You need to register your business with Safaricom Daraja API
2. **Business Shortcode**: Either a Paybill or Till Number from Safaricom
3. **SSL Certificate**: Your callback URL must be HTTPS (required by Safaricom)
4. **Kenyan Business**: The service is available for Kenyan businesses only

## 🔧 Environment Configuration

Add the following environment variables to your `.env` file:

```bash
# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_BUSINESS_SHORTCODE=174379  # Replace with your actual shortcode
MPESA_PASSKEY=your_passkey_here
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
MPESA_ENVIRONMENT=sandbox  # Use 'production' for live environment
```

### Getting Your Credentials

1. **Visit Safaricom Daraja Portal**: https://developer.safaricom.co.ke/
2. **Create an Account**: Register your business
3. **Create an App**: Get Consumer Key and Consumer Secret
4. **Get Business Shortcode**: From your Safaricom business account
5. **Get Passkey**: Provided by Safaricom for Lipa Na M-Pesa Online

## 🏗️ Technical Implementation

### Backend Components

#### 1. M-Pesa Service (`server/mpesa.ts`)
- OAuth token management
- Phone number normalization
- STK Push initiation
- Callback validation
- Error handling

#### 2. API Endpoints (`server/routes.ts`)
- `POST /api/payments/mpesa/initiate` - Start payment
- `POST /api/payments/mpesa/callback` - Handle Safaricom callbacks
- `GET /api/orders/:id/payment-status` - Check payment status

#### 3. Database Schema
The existing schema already includes M-Pesa fields:
- `mpesaMerchantRequestId`
- `mpesaCheckoutRequestId`
- `mpesaReceiptNumber`
- `mpesaStatus`
- `mpesaPhone`
- `paymentMethod`
- `paidAt`

### Frontend Integration

The checkout page (`client/src/pages/CheckoutPage.tsx`) now includes:
- M-Pesa payment method selection
- Phone number input with validation
- Real-time payment status polling
- Comprehensive error handling
- Timeout management

## 🔄 Payment Flow

1. **Customer Selection**: Customer chooses M-Pesa payment method
2. **Order Creation**: Order is created with pending status
3. **STK Push Initiation**: System sends payment request to customer's phone
4. **Customer Action**: Customer enters M-Pesa PIN on their phone
5. **Payment Processing**: Safaricom processes the payment
6. **Callback Handling**: Safaricom notifies our system of payment result
7. **Order Update**: Order status is updated based on payment result
8. **Customer Notification**: Frontend shows success/failure message

## 🧪 Testing

### Sandbox Testing

1. **Use Safaricom Test Credentials**: Available on Daraja portal
2. **Test Phone Numbers**: Use provided test numbers (e.g., 254708374149)
3. **Test Amounts**: Use amounts between 1-70000 KES

### Production Testing

1. **Start with Small Amounts**: Test with 1-10 KES initially
2. **Verify Callback URL**: Ensure it's accessible from Safaricom servers
3. **Monitor Logs**: Check application logs for any issues
4. **Test Different Scenarios**: Success, failure, timeout, cancellation

## 🔒 Security Features

### Implemented Security Measures

1. **Callback Validation**: Verifies incoming callback structure
2. **Idempotent Processing**: Prevents duplicate payment processing
3. **Phone Number Validation**: Comprehensive Kenyan number validation
4. **Amount Validation**: Ensures amounts are within limits
5. **Timeout Handling**: Prevents hanging transactions
6. **Error Logging**: Detailed logging for troubleshooting

### Additional Recommendations

1. **IP Whitelisting**: Consider whitelisting Safaricom IP addresses
2. **Rate Limiting**: Implement rate limiting on payment endpoints
3. **Monitoring**: Set up alerts for failed payments
4. **Backup Strategy**: Have a manual reconciliation process

## 🚨 Error Handling

The system handles various error scenarios:

### Customer-Facing Errors
- Invalid phone numbers
- Insufficient funds
- Payment timeouts
- Network connectivity issues
- Payment cancellation

### Technical Errors
- OAuth token failures
- Callback validation errors
- Database connection issues
- External API timeouts

## 📊 Monitoring & Analytics

### Key Metrics to Monitor
1. **Payment Success Rate**: Track successful vs failed payments
2. **Response Times**: Monitor API response times
3. **Error Rates**: Track different types of errors
4. **User Experience**: Time from initiation to completion

### Logging
The system provides comprehensive logging for:
- Payment initiations
- Callback receipts
- Error conditions
- Status changes

## 🔧 Troubleshooting

### Common Issues

#### 1. "M-Pesa not configured" Error
**Solution**: Verify all environment variables are set correctly

#### 2. "Invalid phone number" Error
**Solution**: Ensure phone numbers are in correct Kenyan format (0712345678, 254712345678, or 712345678)

#### 3. Callback Not Received
**Solutions**:
- Verify callback URL is accessible via HTTPS
- Check firewall settings
- Confirm URL is registered with Safaricom

#### 4. Payment Stuck in "Initiated" Status
**Solutions**:
- Check if callback was received
- Verify customer completed payment on phone
- Check Safaricom system status

## 🔄 Deployment Checklist

### Before Going Live

- [ ] All environment variables configured
- [ ] SSL certificate installed and valid
- [ ] Callback URL accessible from internet
- [ ] Test transactions successful
- [ ] Monitoring and alerts configured
- [ ] Customer support process defined
- [ ] Reconciliation process established

### Production Environment

- [ ] Switch `MPESA_ENVIRONMENT` to `production`
- [ ] Use production credentials from Safaricom
- [ ] Update business shortcode to production value
- [ ] Test with real phone numbers and small amounts

## 📞 Support

### Customer Support Process

1. **Payment Issues**: Direct customers to check M-Pesa messages
2. **Technical Issues**: Check application logs first
3. **Reconciliation**: Compare M-Pesa statements with system records
4. **Refunds**: Process through Safaricom business portal

### Development Support

For technical issues during implementation:
1. Check the comprehensive error messages in the system
2. Review the logs for detailed error information
3. Verify environment configuration
4. Test with sandbox credentials first

## 🎯 Success Metrics

The integration is successful when:
- [ ] Payments complete within 30 seconds
- [ ] Success rate > 95%
- [ ] Customers can easily complete payments
- [ ] All payments are properly reconciled
- [ ] Error handling provides clear guidance

## 📈 Future Enhancements

Consider these improvements for the future:
1. **Payment Analytics Dashboard**
2. **Automated Reconciliation**
3. **Customer Payment History**
4. **Refund Processing**
5. **Multi-currency Support**

---

## 📋 Environment Variables Summary

```bash
# Copy these to your .env file and update with your values
MPESA_CONSUMER_KEY=your_consumer_key
MPESA_CONSUMER_SECRET=your_consumer_secret
MPESA_BUSINESS_SHORTCODE=your_shortcode
MPESA_PASSKEY=your_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
MPESA_ENVIRONMENT=sandbox  # or 'production'
```

**🚀 You're all set! The M-Pesa integration is ready to use once you configure the environment variables.**