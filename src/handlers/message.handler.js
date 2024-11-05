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
      

      // // Mark message as read
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

  /**
   * Determines the intent of the user's message based on keywords
   * @param {string} messageText - The text content of the message
   * @returns {string} The determined intent
   */
  static determineIntent(messageText) {
    const text = messageText.toLowerCase();
    
    if (text.includes('tv') || text.includes('television')) {
      return 'PAY_TV';
    }
    if (text.includes('water') || text.includes('bill water')) {
      return 'PAY_WATER';
    }
    if (text.includes('electricity') || text.includes('power') || text.includes('bill light')) {
      return 'PAY_ELECTRICITY';
    }
    if (text.includes('prn') || text.includes('payment reference')) {
      return 'PAY_PRN';
    }
    if (text.includes('yes') || text.includes('confirm') || text.includes('proceed')) {
      return 'CONFIRM';
    }
    
    return 'UNKNOWN';
  }

  /**
   * Handles confirmation messages from the user
   * @param {Object} message - The message object
   * @param {Object} session - The user's session
   * @param {string} businessPhoneNumberId - The business phone number ID
   */
  static async handleConfirmation(message, session, businessPhoneNumberId) {
    try {
      if (!session.state.currentService || !session.state.paymentDetails) {
        await this.showServices(message, session, businessPhoneNumberId);
        return;
      }

      const confirmationMessage = `You've confirmed payment for ${session.state.currentService.toUpperCase()}.\n` +
        `Amount: ${session.state.paymentDetails.amount}\n` +
        `Reference: ${session.state.paymentDetails.reference}\n\n` +
        `Processing your payment...`;

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        confirmationMessage
      );

      // Process the payment here
      await PaymentService.processPayment(session.state.paymentDetails);

      // Clear the session state after successful payment
      session.clearPaymentDetails();
      
    } catch (error) {
      logger.error('Error handling confirmation', { error, sessionId: session.id });
      throw error;
    }
  }

  /**
   * Shows available services to the user
   * @param {Object} message - The message object
   * @param {Object} session - The user's session
   * @param {string} businessPhoneNumberId - The business phone number ID
   */
  static async showServices(message, session, businessPhoneNumberId) {
    const servicesMessage = 
      "Welcome! 👋 Please choose a service to pay for:\n\n" +
      "1. TV Subscription 📺\n" +
      "2. Water Bill 💧\n" +
      "3. Electricity Bill ⚡\n" +
      "4. Pay with Reference Number (PRN) 🔢\n\n" +
      "Reply with the service you'd like to pay for.";

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      servicesMessage
    );
  }
}