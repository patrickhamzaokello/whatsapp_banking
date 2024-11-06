import crypto from 'crypto';
import logger from '../config/logger.js';
import {config} from '../config/environment.js';
import {PaymentError} from '../errors/custom-errors.js';
import { URLSHORTNER } from './url_shortner.service.js';

export class PaymentService {
  static async generatePaymentDetails(service, amount, userName, email) {
    const orderId = this.generateOrderId();
    const transDate = this.getCurrentDate();
    const payerName = this.formatName(userName);
    const transDetails = this.formatTransDetails(service);

    return {
      amount,
      currency: config.payment.currency,
      customerCode: config.payment.customerCode,
      orderId,
      payerName,
      transDetails,
      transDate,
      emailAddress: email,
      service
    };
  }

  static async generatePaymentLink(paymentDetails) {
    try {
      const {
        amount,
        currency,
        customerCode,
        orderId,
        payerName,
        transDetails,
        transDate,
        emailAddress
      } = paymentDetails;

      const secureSecret = config.payment.gtbankSecret;
      const gtp_SecureHashType = "SHA256";

      const hash_input_data = 
        `gtp_Amount=${amount}&` +
        `gtp_Currency=${currency}&` +
        `gtp_CustomerCode=${customerCode}&` +
        `gtp_OrderId=${orderId}&` +
        `gtp_PayerName=${payerName}&` +
        `gtp_TransDetails=${transDetails}`;

      const secure_hash = this.hashAllFields(hash_input_data, gtp_SecureHashType, secureSecret);

      const url = 
        `${config.payment.baseUrl}?` +
        `${hash_input_data}&` +
        `gtp_TransDate=${transDate}&` +
        `gtp_SecureHash=${secure_hash}&` +
        `gtp_SecureHashType=${gtp_SecureHashType}&` +
        `gtp_EmailAddress=${emailAddress}`;

      logger.info('Payment link generated', { orderId, payerName, service: paymentDetails.service });

      //shorten the url and return
      const shortCode = URLSHORTNER.generateShortCode();
      URLSHORTNER.saveUrl(shortCode, url);
      const shorten_url = `https://socialbanking.gtbank.co.ug/${shortCode}`;

      
      return shorten_url;

    } catch (error) {
      logger.error('Error generating payment link', { error, paymentDetails });
      throw new PaymentError('Failed to generate payment link');
    }
  }

  static hashAllFields(hash_input, secureHashType, secureSecret) {
    hash_input = hash_input.replace(/&$/, '');
    const secret_bytes = Buffer.from(secureSecret, 'hex');
    
    return crypto.createHmac('sha256', secret_bytes)
      .update(hash_input + secureHashType)
      .digest('hex')
      .toUpperCase();
  }

  static generateOrderId() {
    return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static getCurrentDate() {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
  }

  static formatName(name) {
    return name.replace(/\s+/g, '-');
  }

  static formatTransDetails(service) {
    return `Payment-for-${service}`.replace(/\s+/g, '-');
  }
}