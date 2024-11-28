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

const router = express.Router();

router.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    // Check if "messages" exist in the payload
    const contact = req.body.entry?.[0]?.changes[0]?.value?.contacts?.[0];
    const businessPhoneNumberId = req.body.entry?.[0].changes?.[0].value?.metadata?.phone_number_id;
    const messages = data?.entry?.[0]?.changes?.[0]?.value?.messages;

    if (messages && messages.length > 0) {
      // Check if the first message has a text payload
      const textPayload = messages[0]?.text;
      const message_id = messages[0]?.id;

      if (textPayload) {
        await MessageHandler.handleIncomingWithQueue(messages[0], contact, businessPhoneNumberId);
      } else {
        if (messages[0]?.interactive?.button_reply) {

          const button_id = messages[0]?.interactive?.button_reply?.id
          if (button_id == "payService") {
            FlowService.sendFlow("442394835264933", contact.wa_id, businessPhoneNumberId)
          } else {
            await WhatsAppService.sendMessage(
              businessPhoneNumberId,
              contact.wa_id,
              'This service will be available soon',
              messages[0]?.id
            );
          }
        } else if (messages[0]?.interactive?.nfm_reply) {
          await FlowService.flow_reply_processor(businessPhoneNumberId, req, message_id);
        }
      }
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error('Webhook error', { error });
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