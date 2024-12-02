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

  static async generateReceiptPDF(transactionData) {
    try {      
      // Create a new PDF document
      const doc = new PDFDocument({ size: 'A6' });
      
      // Generate QR Code
      const qrCodeData = `Transaction ID: ${transactionData.transactionDetails.transactionId}\n` +
                         `Amount: UGX ${transactionData.transactionDetails.amount.toLocaleString()}\n` +
                         `Date: ${transactionData.transactionDetails.date.toLocaleString()}`;
      
      const qrCodeImage = await QRCode.toDataURL(qrCodeData);

      // Set response headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt_${transactionId}.pdf`);
      
      // Pipe the PDF to the response
      doc.pipe(res);

      // Receipt Design
      doc.fontSize(14)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50')
         .text('Payment Receipt', { align: 'center' });

      doc.moveDown();

      // Transaction Details
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .text('Transaction Details', { underline: true });
      
      const { transactionDetails, customerDetails } = transactionData;
      
      doc.font('Helvetica')
         .text(`Transaction ID: ${transactionDetails.transactionId}`)
         .text(`Flow Token: ${transactionDetails.flowToken}`)
         .text(`Service Type: ${transactionDetails.serviceType}`)
         .text(`Payment Method: ${transactionDetails.paymentMethod}`)
         .text(`Amount: UGX ${transactionDetails.amount.toLocaleString()}`)
         .text(`Status: ${transactionDetails.status}`)
         .text(`Date: ${transactionDetails.date.toLocaleString()}`);

      doc.moveDown();

      // Customer Details
      doc.font('Helvetica-Bold')
         .text('Customer Information', { underline: true });
      
      doc.font('Helvetica')
         .text(`Name: ${customerDetails.name}`)
         .text(`Email: ${customerDetails.email}`)
         .text(`Phone: ${customerDetails.phone}`);

      // Footer
      doc.fontSize(8)
         .fillColor('#666666')
         .text('Thank you for your payment!', { align: 'center' });

      // Finalize PDF
      doc.end();
    } catch (err) {
      // Error handling
      console.error('Error generating receipt PDF:', err);
      res.status(500).json({
        error: true,
        message: 'Failed to generate receipt',
        details: err.message
      });
    }
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
    return name.replace(/_/g, ' ').replace(/\s+/g, ' ');
  }

  static formatTransDetails(service) {
    return `Payment for ${service.replace(/_/g, ' ')}`.replace(/\s+/g, ' ');
  }
  
}