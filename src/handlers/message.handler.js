import logger from '../config/logger.js';
import {SessionService} from '../services/session.service.js';
import {WhatsAppService} from '../services/whatsapp.service.js';
import {PaymentService} from '../services/payment.service.js';

export class MessageHandler {
  static async handleIncoming(message, contact, businessPhoneNumberId) {
    try {
      const userPhone = contact.wa_id;
      const userName = contact.profile.name;
      
      let session = SessionService.getSession(userPhone) || 
                    SessionService.createSession(userPhone, userName);
      
      session.resetTimeout();
      
      // Mark message as read
      await WhatsAppService.markMessageAsRead(businessPhoneNumberId, message.id);
      
      const intent = this.determineIntent(message.text.body);
      await this.processIntent(intent, message, session, businessPhoneNumberId);
      
    } catch (error) {
      logger.error('Error handling incoming message', {  error, message });
      throw error;
    }
  }

  static async processIntent(intent, message, session, businessPhoneNumberId) {
    try {
      switch (intent) {
        case 'PAY_TV':
        case 'PAY_WATER':
        case 'PAY_ELECTRICITY':
        case 'PAY_PRN':
          await this.startPaymentFlow(intent, message, session, businessPhoneNumberId);
          break;
        case 'CONFIRM':
          await this.handleConfirmation(message, session, businessPhoneNumberId);
          break;
        default:
          await this.showServices(message, session, businessPhoneNumberId);
      }
    } catch (error) {
      logger.error('Error processing intent', { error, intent });
      throw error;
    }
  }

  static async startPaymentFlow(intent, message, session, businessPhoneNumberId) {
    const service = intent.split('_')[1].toLowerCase();
    session.state.currentService = service;
    
    const paymentDetails = await PaymentService.generatePaymentDetails(
      service,
      500, // Example amount
      session.userName,
      'default@email.com' // Replace with actual email
    );
    
    session.setPaymentDetails(paymentDetails);
    
    // Generate and send payment link
    const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);
    
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `Thank you ${session.userName}! Click here to complete your payment:\n\n${paymentLink}`
    );
  }
}