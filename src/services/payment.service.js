import crypto from 'crypto';
import logger from '../config/logger.js';
import {config} from '../config/environment.js';
import {PaymentError} from '../errors/custom-errors.js';
import { URLSHORTNER } from './url_shortner.service.js';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode'
import path from 'path';
import fs from 'fs';

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

  static async generateReceiptPDF(transactionData, options = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        const { logoPath } = options;
        console.log(logoPath)
        // Ensure receipts directory exists
        const receiptDir = path.join(process.cwd(), 'src', 'public', 'receipts');
        if (!fs.existsSync(receiptDir)) {
          fs.mkdirSync(receiptDir, { recursive: true });
        }

        // Generate unique filename
        const filename = `receipt_${transactionData.transactionDetails.flowToken}.pdf`;
        const filePath = path.join(receiptDir, filename);

        // Create write stream
        const writeStream = fs.createWriteStream(filePath);

        // Create a new PDF document with more generous margins
        const doc = new PDFDocument({ 
          size: 'A5', 
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          }
        });

        // Pipe PDF to write stream
        doc.pipe(writeStream);

        // Enhanced Color Palette (Minimalist)
        const colors = {
          background: '#FFFFFF',
          primary: '#000000',
          secondary: '#666666',
          accent: '#11151D',
          border: '#E0E0E0'
        };

        // Page dimensions
        const pageWidth = doc.page.width - 100; // Subtract margins
        
        
        // Add logo if provided
        if (logoPath && fs.existsSync(logoPath)) {
          // Logo dimensions and positioning
          const logoWidth = 50;
          const logoHeight = 50;
          
          doc.image(logoPath, doc.page.margins.left, doc.page.margins.top, {
            width: logoWidth,
            height: logoHeight,
            align: 'left',
            valign: 'top'
          });

          // Move down after logo
          doc.moveDown(1);
        }

        // Helper function to create a two-column layout with consistent alignment
        const createTwoColumnLayout = (doc, items, options = {}) => {
          const { 
            labelColor = colors.primary, 
            valueColor = colors.accent, 
            fontSize = 10,
            labelFont = 'Helvetica',
            valueFont = 'Helvetica-Bold'
          } = options;

          // Total page width minus margins
          const totalWidth = doc.page.width - (doc.page.margins.left + doc.page.margins.right);
          
          items.forEach((item, index) => {
            // Reset cursor position for each item
            doc.fontSize(fontSize);

            // Start a new text block that spans the full page width
            doc.text('', { 
              width: totalWidth,
              align: 'justify'
            });

            // Label on the left
            doc.fillColor(labelColor)
               .font(labelFont)
               .text(item.label, { 
                 continued: true,
                 align: 'left'
               });

            // Value on the right
            doc.fillColor(valueColor)
               .font(valueFont)
               .text(item.value, { 
                 align: 'right'
               });

            // Add subtle separator (except for last item)
            if (index < items.length - 1) {
              doc.moveDown(0.5)
                 .strokeColor(colors.border)
                 .lineWidth(0.5)
                 .moveTo(doc.page.margins.left, doc.y)
                 .lineTo(doc.page.width - doc.page.margins.right, doc.y)
                 .stroke();
              doc.moveDown(0.5);
            }
          });
        };

        // Destructure transaction data
        const { transactionDetails, customerDetails } = transactionData;

        // Header
        doc.fontSize(18)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('RECEIPT', { 
             align: 'center',
             underline: true
           });

        doc.moveDown(1.5);

        // Transaction Header
        doc.fontSize(10)
           .fillColor(colors.secondary)
           .font('Helvetica')
           .text(`Receipt No: ${transactionDetails.flowToken}`, { 
             align: 'left', 
             continued: false 
           });
        doc.moveDown(1);

        doc.fontSize(10)
           .fillColor(colors.primary)
           .text(`Date: ${transactionDetails.date.toLocaleString()}`, { 
             align: 'left' 
           });

        doc.moveDown(1);

        // Transaction Details
        const transactionItems = [
          { label: 'Transaction ID', value: transactionDetails.transactionId },
          { label: 'Service Type', value: transactionDetails.serviceType },
          { label: 'Payment Method', value: transactionDetails.paymentMethod },
          { label: 'Amount', value: `UGX ${transactionDetails.amount.toLocaleString()}` },
          { label: 'Status', value: transactionDetails.status }
        ];

        createTwoColumnLayout(doc, transactionItems);

        doc.moveDown(1.5);

        // Customer Information Header
        doc.fontSize(12)
           .fillColor(colors.primary)
           .font('Helvetica-Bold')
           .text('Customer', { align: 'left' });

        doc.moveDown(0.5);

        // Customer Details
        const customerItems = [
          { label: 'Name', value: customerDetails.name },
          { label: 'Email', value: customerDetails.email },
          { label: 'Phone', value: customerDetails.phone }
        ];

        createTwoColumnLayout(doc, customerItems, {
          labelColor: colors.primary,
          valueColor: colors.secondary,
          valueFont: 'Helvetica'
        });

        // Move to bottom of page for QR Code
        doc.switchToPage(0);
        const pageHeight = doc.page.height;
        
        // QR Code Generation
        const qrCodeData = JSON.stringify({
          transactionId: transactionDetails.transactionId,
          amount: `UGX ${transactionDetails.amount.toLocaleString()}`,
          date: transactionDetails.date.toLocaleString()
        });

        // Generate QR Code
        const qrCodeImage = await QRCode.toDataURL(qrCodeData);

        // Position QR Code at the bottom
        const qrCodeSize = 100;
        const xPosition = (doc.page.width - qrCodeSize) / 2;
        const yPosition = pageHeight - qrCodeSize - 100; // 100 from bottom

        // Convert data URL to buffer
        const qrCodeBuffer = Buffer.from(qrCodeImage.split(',')[1], 'base64');
        
        // Add QR Code to bottom of page
        doc.image(qrCodeBuffer, xPosition, yPosition, { 
          width: qrCodeSize,
          align: 'center'
        });

        // QR Code label
        doc.fontSize(8)
           .fillColor(colors.secondary)
           .text('Scan for transaction details', { 
             align: 'center',
             y: yPosition + qrCodeSize + 10
           });

        // Footer
        doc.fontSize(8)
           .fillColor(colors.secondary)
           .text('Thank you for your transaction', { 
             align: 'center', 
             y: pageHeight - 50 
           });

        // Finalize PDF
        doc.end();

        // Handle stream events
        writeStream.on('finish', () => {
          try {
            // Create a  return the file path and a buffer
            const fileBuffer = fs.readFileSync(filePath);

            resolve({
              filePath: path.relative(process.cwd(), filePath),
              file: fileBuffer,
              filename: filename
            });
          } catch (err) {
            reject(new Error(`Failed to create File object: ${err.message}`));
          }
        });

        writeStream.on('error', (err) => {
          reject(new Error(`Failed to write PDF: ${err.message}`));
        });

      } catch (err) {
        reject(new Error(`Error generating receipt PDF: ${err.message}`));
      }
    });
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