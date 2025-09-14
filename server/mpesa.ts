import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();

// Environment variables required for Mpesa integration
// Add these to your environment:
// MPESA_CONSUMER_KEY=your_safaricom_consumer_key
// MPESA_CONSUMER_SECRET=your_safaricom_consumer_secret  
// MPESA_BUSINESS_SHORTCODE=your_paybill_or_till_number
// MPESA_PASSKEY=your_lipa_na_mpesa_online_passkey
// MPESA_CALLBACK_URL=https://your-domain.com/api/payments/mpesa/callback
// MPESA_ENVIRONMENT=sandbox|production (defaults to sandbox)

interface MpesaConfig {
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passKey: string;
  callbackUrl: string;
  baseUrl: string;
}

export class MpesaService {
  private config: MpesaConfig;

  constructor() {
    // Determine API base URL
    const environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    const baseUrl = environment === 'production' 
      ? 'https://api.safaricom.co.ke' 
      : 'https://sandbox.safaricom.co.ke';

    this.config = {
      consumerKey: process.env.MPESA_CONSUMER_KEY || '',
      consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
      businessShortCode: process.env.MPESA_BUSINESS_SHORTCODE || '',
      passKey: process.env.MPESA_PASSKEY || '',
      callbackUrl: process.env.MPESA_CALLBACK_URL || '',
      baseUrl,
    };

    // Validate required environment variables
    const missing = Object.entries(this.config)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      console.warn(`Missing Mpesa configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Check if Mpesa is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.consumerKey &&
      this.config.consumerSecret &&
      this.config.businessShortCode &&
      this.config.passKey &&
      this.config.callbackUrl
    );
  }

  /**
   * Get business short code for public access
   */
  getBusinessShortCode(): string {
    return this.config.businessShortCode;
  }

  /**
   * Generate OAuth access token
   */
  async getAccessToken(): Promise<string> {
    const auth = Buffer.from(
      `${this.config.consumerKey}:${this.config.consumerSecret}`
    ).toString('base64');

    const response = await fetch(
      `${this.config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    // console.log("boom" , response)
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get OAuth token: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * Normalize phone number to E.164 format (254XXXXXXXXX)
   */
  normalizePhoneNumber(phone: string): string {
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Validate minimum length
    if (cleaned.length < 9) {
      throw new Error('Phone number is too short. Please enter a valid Kenyan phone number.');
    }
    
    if (cleaned.length > 12) {
      throw new Error('Phone number is too long. Please enter a valid Kenyan phone number.');
    }
    
    let normalized: string;
    
    if (cleaned.startsWith('254')) {
      if (cleaned.length !== 12) {
        throw new Error('Invalid phone number format. Kenyan numbers should have 12 digits including country code.');
      }
      normalized = cleaned;
    } else if (cleaned.startsWith('0')) {
      if (cleaned.length !== 10) {
        throw new Error('Invalid phone number format. Kenyan numbers starting with 0 should have 10 digits.');
      }
      normalized = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
      if (cleaned.length !== 9) {
        throw new Error('Invalid phone number format. Phone number should have 9 digits when excluding country code.');
      }
      normalized = '254' + cleaned;
    } else {
      throw new Error('Invalid phone number format. Must be a Kenyan number (07XXXXXXXX, 254XXXXXXXXX, or 1XXXXXXXX).');
    }
    
    // Validate network prefixes (Safaricom, Airtel, Telkom)
    const prefix = normalized.substring(3, 5);
    const validPrefixes = ['70', '71', '72', '79', '74', '75', '76', '77', '78', '10', '11'];
    
    if (!validPrefixes.includes(prefix)) {
      throw new Error('Invalid phone number. Please enter a valid Kenyan mobile number.');
    }
    
    return normalized;
  }

  /**
   * Generate timestamp in the format required by Mpesa
   */
  generateTimestamp(): string {
    const now = new Date();
    return now.getFullYear().toString() +
           (now.getMonth() + 1).toString().padStart(2, '0') +
           now.getDate().toString().padStart(2, '0') +
           now.getHours().toString().padStart(2, '0') +
           now.getMinutes().toString().padStart(2, '0') +
           now.getSeconds().toString().padStart(2, '0');
  }

  /**
   * Generate password for STK push
   */
  generatePassword(timestamp: string): string {
    const data = this.config.businessShortCode + this.config.passKey + timestamp;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Initiate STK Push payment
   */
  async initiateSTKPush(params: {
    phone: string;
    amount: number;
    orderId: string;
    accountReference: string;
    transactionDesc: string;
  }): Promise<{
    merchantRequestID: string;
    checkoutRequestID: string;
    responseCode: string;
    responseDescription: string;
    customerMessage: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Mpesa is not properly configured');
    }

    // Validate amount
    if (params.amount <= 0 || params.amount > 70000) {
      throw new Error('Invalid amount. Amount must be between KSh 1 and KSh 70,000');
    }

    let accessToken: string;
    let normalizedPhone: string;
    
    try {
      accessToken = await this.getAccessToken();
 
    } catch (error: any) {
      console.error('Failed to get OAuth token:', error.message);
      throw new Error('Failed to authenticate with M-Pesa. Please try again later.');
    }

    try {
      normalizedPhone = this.normalizePhoneNumber(params.phone);
    } catch (error: any) {
      throw new Error(`Invalid phone number: ${error.message}`);
    }

    const timestamp = this.generateTimestamp();
    const password = this.generatePassword(timestamp);

    const requestBody = {
      BusinessShortCode: this.config.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.floor(params.amount), // Ensure integer
      PartyA: normalizedPhone,
      PartyB: this.config.businessShortCode,
      PhoneNumber: normalizedPhone,
      CallBackURL: this.config.callbackUrl,
      AccountReference: params.accountReference,
      TransactionDesc: params.transactionDesc,
    };

    console.log('Initiating STK Push:', {
      orderId: params.orderId,
      phone: normalizedPhone,
      amount: params.amount,
      timestamp
    });

    let response: Response;
    
    try {
      response = await fetch(
        `${this.config.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );
    } catch (error: any) {
      console.error('Network error during STK Push:', error.message);
      throw new Error('Network error. Please check your connection and try again.');
    }

    let responseData: any;
    
    try {
      responseData = await response.json();
    } catch (error: any) {
      console.error('Invalid JSON response from M-Pesa:', error.message);
      throw new Error('Invalid response from M-Pesa service. Please try again.');
    }

    if (!response.ok) {
      console.error('STK Push failed:', responseData);
      
      // Handle specific error codes
      const errorMessage = responseData.errorMessage || responseData.errorCode || 'Unknown error';
      
      if (errorMessage.includes('insufficient funds')) {
        throw new Error('Insufficient funds in your M-Pesa account.');
      } else if (errorMessage.includes('invalid phone number')) {
        throw new Error('Invalid phone number. Please check and try again.');
      } else if (errorMessage.includes('duplicate')) {
        throw new Error('Duplicate transaction. Please wait a moment before trying again.');
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please contact support.');
      } else if (response.status >= 500) {
        throw new Error('M-Pesa service is temporarily unavailable. Please try again later.');
      } else {
        throw new Error(`Payment failed: ${errorMessage}`);
      }
    }

    // Validate response structure
    if (!responseData.MerchantRequestID || !responseData.CheckoutRequestID) {
      console.error('Invalid STK Push response structure:', responseData);
      throw new Error('Invalid response from M-Pesa. Please try again.');
    }

    return {
      merchantRequestID: responseData.MerchantRequestID,
      checkoutRequestID: responseData.CheckoutRequestID,
      responseCode: responseData.ResponseCode || '0',
      responseDescription: responseData.ResponseDescription || 'Success',
      customerMessage: responseData.CustomerMessage || 'Please complete payment on your phone',
    };
  }

  /**
   * Query STK Push transaction status
   */
  async querySTKStatus(params: {
    businessShortCode: string;
    password: string;
    timestamp: string;
    checkoutRequestID: string;
  }): Promise<{
    responseCode: string;
    responseDescription: string;
    merchantRequestID: string;
    checkoutRequestID: string;
    resultCode: string;
    resultDesc: string;
  }> {
    if (!this.isConfigured()) {
      throw new Error('Mpesa is not properly configured');
    }

    let accessToken: string;
    let response: Response;
    let responseData: any;

    try {
      accessToken = await this.getAccessToken();
    } catch (error: any) {
      console.error('Failed to get OAuth token for STK query:', error.message);
      throw new Error('Failed to authenticate with M-Pesa for status query. Please try again later.');
    }

    try {
      response = await fetch(
        `${this.config.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params),
        }
      );
    } catch (error: any) {
      console.error('Network error during STK Query:', error.message);
      throw new Error('Network error during payment status query. Please check your connection and try again.');
    }

    try {
      responseData = await response.json();
    } catch (error: any) {
      console.error('Invalid JSON response from M-Pesa STK Query:', error.message);
      throw new Error('Invalid response from M-Pesa status query. Please try again.');
    }

    if (!response.ok) {
      console.error('STK Query failed:', responseData);
      throw new Error(`STK Query failed: ${responseData.errorMessage || 'Unknown error'}`);
    }

    console.log("M-Pesa STK Query Response:", responseData);
    
    // CRITICAL: Validate required fields exist before processing
    // Never default critical payment status fields to success values
    const responseCode = responseData.ResponseCode || responseData.responseCode;
    const responseDescription = responseData.ResponseDescription || responseData.responseDescription;
    const merchantRequestID = responseData.MerchantRequestID || responseData.merchantRequestID;
    const checkoutRequestID = responseData.CheckoutRequestID || responseData.checkoutRequestID;
    const resultCode = responseData.ResultCode?.toString() || responseData.resultCode?.toString();
    const resultDesc = responseData.ResultDesc || responseData.resultDesc;

    // CRITICAL: If ResultCode is missing, this indicates a malformed response
    // We MUST NOT default to success ('0') as this could cause false positive payments
    if (resultCode === undefined || resultCode === null || resultCode === '') {
      console.error('CRITICAL: ResultCode missing from M-Pesa STK Query response:', {
        checkoutRequestID: params.checkoutRequestID,
        responseData: JSON.stringify(responseData, null, 2)
      });
      throw new Error('Incomplete response from M-Pesa: ResultCode missing. Cannot determine payment status.');
    }

    // Additional validation for required identifiers
    if (!merchantRequestID || !checkoutRequestID) {
      console.error('CRITICAL: Required identifiers missing from M-Pesa STK Query response:', {
        requestCheckoutID: params.checkoutRequestID,
        merchantRequestID,
        responseCheckoutID: checkoutRequestID,
        responseData: JSON.stringify(responseData, null, 2)
      });
      throw new Error('Incomplete response from M-Pesa: Required identifiers missing.');
    }

    // Log the final parsed values for debugging
    console.log('M-Pesa STK Query parsed response:', {
      requestCheckoutID: params.checkoutRequestID,
      responseCode,
      resultCode,
      resultDesc,
      merchantRequestID,
      responseCheckoutID: checkoutRequestID
    });
    
    // Return the validated response - no dangerous defaults
    return {
      responseCode: responseCode || 'unknown',
      responseDescription: responseDescription || 'No description provided',
      merchantRequestID,
      checkoutRequestID: checkoutRequestID,
      resultCode,
      resultDesc: resultDesc || 'No description provided'
    };
  }

  /**
   * Generate callback authentication token
   */
  generateCallbackToken(checkoutRequestId: string): string {
    const secret = process.env.MPESA_CALLBACK_SECRET || 'default-secret-change-in-production';
    const data = `${checkoutRequestId}:${this.config.businessShortCode}:${secret}`;
    return Buffer.from(data).toString('base64');
  }

  /**
   * Validate callback authentication token
   */
  validateCallbackAuth(checkoutRequestId: string, token: string): boolean {
    const expectedToken = this.generateCallbackToken(checkoutRequestId);
    return token === expectedToken;
  }

  /**
   * Validate callback data authenticity and structure
   */
  validateCallback(callbackData: any, authToken?: string): boolean {
    // Basic validation - ensure required fields are present
    if (!callbackData.Body || !callbackData.Body.stkCallback) {
      return false;
    }

    const callback = callbackData.Body.stkCallback;
    const hasRequiredFields = !!(
      callback.MerchantRequestID &&
      callback.CheckoutRequestID &&
      callback.ResultCode !== undefined
    );

    if (!hasRequiredFields) {
      return false;
    }

    // If auth token is provided, validate it
    if (authToken) {
      return this.validateCallbackAuth(callback.CheckoutRequestID, authToken);
    }

    // If no auth token provided, still validate structure
    return true;
  }

  /**
   * Extract payment details from callback
   */
  extractCallbackDetails(callbackData: any) {
    const callback = callbackData.Body.stkCallback;
    
    const details = {
      merchantRequestID: callback.MerchantRequestID,
      checkoutRequestID: callback.CheckoutRequestID,
      resultCode: callback.ResultCode,
      resultDesc: callback.ResultDesc,
      amount: null as number | null,
      mpesaReceiptNumber: null as string | null,
      transactionDate: null as Date | null,
      phoneNumber: null as string | null,
    };

    // Extract additional details if payment was successful
    if (callback.ResultCode === 0 && callback.CallbackMetadata?.Item) {
      const items = callback.CallbackMetadata.Item;
      
      for (const item of items) {
        switch (item.Name) {
          case 'Amount':
            details.amount = item.Value;
            break;
          case 'MpesaReceiptNumber':
            details.mpesaReceiptNumber = item.Value;
            break;
          case 'TransactionDate':
            details.transactionDate = new Date(item.Value.toString());
            break;
          case 'PhoneNumber':
            details.phoneNumber = item.Value.toString();
            break;
        }
      }
    }

    return details;
  }
}

export const mpesaService = new MpesaService();