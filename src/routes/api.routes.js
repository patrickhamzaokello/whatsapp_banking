import express from 'express';
import logger from '../config/logger.js';
import { config } from '../config/environment.js';
import { MessageHandler } from '../handlers/message.handler.js';
import { URLSHORTNER } from '../services/url_shortner.service.js';
import { PrnService } from '../services/prns.service.js';
import { FlowService } from '../services/flow.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { PaymentService } from '../services/payment.service.js';
import database from '../config/database.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

router.post("/webhook", async (req, res) => {
  try {
    const { entry } = req.body;

    // Early return if no valid entry
    if (!entry || !entry.length) {
      return res.sendStatus(400);
    }

    const change = entry[0]?.changes?.[0];

    // Extract key information safely
    const metadata = change?.value?.metadata;
    const contact = change?.value?.contacts?.[0];
    const messages = change?.value?.messages;

    if (!messages || !messages.length) {
      return res.sendStatus(200);
    }

    const message = messages[0];
    const businessPhoneNumberId = metadata?.phone_number_id;

    // Unified queue processing for all message types
    await MessageHandler.handleIncomingWithQueue({
      message,
      contact,
      businessPhoneNumberId,
      originalRequest: req.body
    });

    res.sendStatus(200);
  } catch (error) {
    logger.error('Webhook processing error', {
      errorMessage: error.message,
      errorStack: error.stack
    });
    res.sendStatus(500);
  }
});

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  res.setHeader('Content-Type', 'text/plain');

  if (mode === "subscribe" && token === config.webhook.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

router.post('/shorten', (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'URL  is required' });
  }

  const shortCode = URLSHORTNER.generateShortCode();
  URLSHORTNER.saveUrl(shortCode, url);
  res.json({ shortUrl: `https://socialbanking.gtbank.co.ug/${shortCode}` });
});

//test gtpay link
router.get('/testgtpay', async (req, res) => {

  const paymentDetails = await PaymentService.generatePaymentDetails(
    "pay prn",
    "900000",
    "pkasemer",
    "pkasemer@gmail.com"
  );

  const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);

  const paymentMessage =
    `Thank you !\n\n` +
    `Here is the test payment link, 👉 ` +
    `${paymentLink}\n\n` +
    `Click on the link above 👆 to pay using your bank card.\n\n` +
    `Email: email@mail.com\n` +
    `Paying for service with Card!`;

  res.status(200).send(paymentMessage);

});

// receive payment status
router.post('/xpayment-status', async (req, res) => {
  const { status, transaction_id, reference } = req.body;
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  if (!transaction_id) {
    return res.status(400).json({ error: 'Transaction ID is required' });
  }
  if (!reference) {
    return res.status(400).json({ error: 'Reference is required' });
  }

  try {
    // lookup the details and generate the receipts or send payment failed.
    const result = await PaymentService.paymentStatus(status, transaction_id, reference);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/receipt', async (req, res) => {
  // Validate input
  const { transaction_id } = req.body;

  // Input validation with more descriptive error
  if (!transaction_id) {
    return res.status(400).json({
      error: 'Invalid request',
      details: 'Transaction ID is required and must be provided'
    });
  }

  try {
    // Fetch receipt data with error handling
    const receiptData = await database.generateReceiptMessage(transaction_id);

    // Early validation of transaction status

    if (receiptData.transactionDetails.status === 'failed') {
      return res.status(400).json({
        error: 'Invalid transaction status',
        details: 'Receipt is only available for completed transactions'
      });
    }

    // Generate PDF with robust error handling
    let receiptPdf;
    try {
      const logoPath = path.join('/app', 'src', 'public', 'images', 'gtbank_logo.png');
      receiptPdf = await PaymentService.generateReceiptPDF(receiptData, {
        logoPath: logoPath
      });
    } catch (pdfError) {
      // Log the specific PDF generation error
      console.error('Receipt PDF generation failed:', pdfError);
      return res.status(500).json({
        error: 'PDF generation failed',
        details: 'Unable to create transaction receipt'
      });
    }

    // Validate PDF file generation
    if (!receiptPdf || !receiptPdf.file) {
      return res.status(500).json({
        error: 'PDF creation error',
        details: 'No receipt file was generated'
      });
    }

    if (!fs.existsSync(receiptPdf.filePath)) {
      return res.status(500).json({
        error: 'File not found',
        details: receiptPdf
      });
    }
    logger.info(`Uploading file: ${receiptPdf.filePath}`);

    // Upload to WhatsApp with comprehensive error handling
    let mediaId;
    try {
      const uploadResult = await WhatsAppService.uploadWhatsappMedia(receiptPdf.filePath);
      mediaId = uploadResult?.id;
    } catch (uploadError) {
      console.error('WhatsApp media upload failed:', uploadError);
      return res.status(500).json({
        error: 'Media upload failed',
        details: 'Unable to upload receipt to WhatsApp'
      });
    }

    // Validate media upload
    if (!mediaId) {
      return res.status(500).json({
        error: 'Upload unsuccessful',
        details: 'No media ID received from WhatsApp'
      });
    }

    // Send receipt to user
    try {
      await WhatsAppService.sendTransactionReceipt(
        mediaId,
        '256783604580',
        'URA Tax Payment',
        'Payment Receipt'
      );
    } catch (sendError) {
      console.error('Receipt send failed:', sendError);
      // Non-critical error - we've uploaded the media, just log the send failure
      console.warn(`Failed to send receipt for transaction ${transaction_id}`);
    }

    // Respond with media ID
    res.status(200).json({
      message: 'Receipt processed successfully',
      mediaId: mediaId
    });

  } catch (error) {
    // Catch-all error handler with logging
    console.error(`Receipt generation error for transaction ${transaction_id}:`, error);

    res.status(500).json({
      error: 'Internal server error',
      details: 'Unable to process receipt request'
    });
  }
});

//test db connection
router.get('/testdb', async (req, res) => {
  (async () => {
    try {
      const phoneNumber = '256787250196';
      const fullName = 'Pkasemer';

      const userId = await database.getOrCreateUser(phoneNumber, fullName);
      console.log('User ID:', userId);
      return res.status(200).json({ userId: userId });
    } catch (err) {
      console.error('Error:', err);
      return res.status(400).json({ err: err });
    }
  })();

});

router.post('/validate-prn', async (req, res) => {
  const prnService = new PrnService();
  const { prn } = req.body;
  if (!prn) {
    return res.status(400).json({ error: 'PRN is required' });
  }

  try {
    const result = await prnService.validatePRN(prn);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/complete-prn', async (req, res) => {
  const prnService = new PrnService();
  const { prn, phone_number } = req.body;
  if (!prn) {
    return res.status(400).json({ error: 'PRN is required' });
  }
  if (!phone_number) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  try {
    const result = await prnService.universialPRNCompleteTransaction(prn, phone_number);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



router.get("/", (req, res) => {
  res.status(200).send(`<pre>GTbank Whatsapp API Endpoint</pre>`);
});

process.on('SIGINT', async () => {
  await dbConnection.close();
  process.exit(0);
});
export default router;