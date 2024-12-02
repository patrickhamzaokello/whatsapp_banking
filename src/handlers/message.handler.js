import logger from '../config/logger.js';
import { SessionService } from '../services/session.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import messageQueue from '../queue/MessageQueue.js';
import { logIncomingMessage } from '../config/message-logger.js';
import { FlowService } from '../services/flow.service.js';
import database from '../config/database.js';

export class MessageHandler {
  // Allowed contacts list moved to a class-level constant
  static ALLOWED_CONTACTS = ["256783604580", "256787250196", "256706943977", "256778687196"];

  // Unified method for handling incoming messages via queue
  static async handleIncomingWithQueue(payload) {
    try {
      const { message, contact, businessPhoneNumberId } = payload;

      // Determine message type and process accordingly
      if (message.text) {
        await this.processTextMessage(message, contact, businessPhoneNumberId);
      } else if (message.interactive?.button_reply) {
        await this.processButtonReply(message, contact, businessPhoneNumberId);
      } else if (message.interactive?.nfm_reply) {
        await this.processFormReply(message, contact, businessPhoneNumberId);
      } else {
        // Log unsupported message types
        logger.warn('Unsupported message type received', { message });
      }
    } catch (error) {
      logger.error('Error in handleIncomingWithQueue', { error, payload });
      throw error;
    }
  }

  // Process standard text messages
  static async processTextMessage(message, contact, businessPhoneNumberId) {
    try {
      const userPhone = contact.wa_id;
      const userName = contact.profile.name;
      const messageText = message.text.body.toLowerCase();

      // Check if contact is allowed
      if (!this.ALLOWED_CONTACTS.includes(userPhone)) {
        await this.sendDevelopmentMessage(businessPhoneNumberId, userPhone);
        return;
      }

      // Create or retrieve user
      const userId = await database.getOrCreateUser(userPhone, userName);

      // Log message
      await database.insertMessageLog(
        userId,
        message.id,
        messageText,
        'I', // Incoming message
        userPhone
      );
      logIncomingMessage(userPhone, message.text.body);

      // Manage session
      let session = SessionService.getSession(userPhone) || SessionService.createSession(userPhone, userName);
      session.resetTimeout();

      // Mark message as read
      await WhatsAppService.markMessageAsRead(businessPhoneNumberId, message.id);

      // Determine and process intent
      const intent = this.determineIntent(messageText);
      await this.processIntent(intent, message, session, businessPhoneNumberId);

    } catch (error) {
      logger.error('Error processing text message', { error, message });
      throw error;
    }
  }

  // Process button replies
  static async processButtonReply(message, contact, businessPhoneNumberId) {
    try {
      const buttonId = message.interactive.button_reply.id;

      switch (buttonId) {
        case "payService":
          await this.sendFlowMessage("442394835264933", message, businessPhoneNumberId);
          break;
        default:
          // Handle other button replies or send a default message
          await WhatsAppService.sendMessage(
            businessPhoneNumberId,
            contact.wa_id,
            'This service will be available soon',
            message.id
          );
      }
    } catch (error) {
      logger.error('Error processing button reply', { error, message });
      throw error;
    }
  }

  // Process form replies
  static async processFormReply(message, contact, businessPhoneNumberId) {
    try {
      await FlowService.flow_reply_processor(
        businessPhoneNumberId,
        message,
        message.id
      );
    } catch (error) {
      logger.error('Error processing form reply', { error, message });
      throw error;
    }
  }

  // Existing methods remain the same
  static determineIntent(messageText) {
    const text = messageText.toLowerCase();
    return text.includes('pay') ? 'PAYBILLS' : 'MAINMENU';
  }

  static async processIntent(intent, message, session, businessPhoneNumberId) {
    session.resetState();
    await this.showServices(message, businessPhoneNumberId);
  }

  static async sendFlowMessage(flow_id, message, businessPhoneNumberId){
    const receiver_number = message.from;
    await FlowService.sendFlow(flow_id, receiver_number, businessPhoneNumberId)
  }

  // Send development stage message
  static async sendDevelopmentMessage(businessPhoneNumberId, userPhone) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      userPhone,
      'This channel is still in development, please contact customer support directly for assistance'
    );
  }

  // Show services method corrected
  static async showServices(message, businessPhoneNumberId) {
    try {
      const message_body = "Welcome to Gtbank Uganda, use the buttons below to proceed";
      await FlowService.sendInteractiveMessage(message_body, message.from, businessPhoneNumberId);
    } catch (error) {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        "Temporarily Unavailable, Please try again",
        message.id
      );
      logger.error('Error sending interactive message', { error });
      throw error;
    }
  }

  static async validateEmail(email) {
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const isValidEmail = emailRegex.test(email);
    email = email.toLowerCase();
    return { status: isValidEmail, user_email: email }
  }

  static async validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^(?:256|\+256|0)?([17]\d{8}|[2-9]\d{8})$/;
    const cleanPhoneNumber = phoneNumber.replace(/[\s-]/g, '');
    const formatPhoneNumber = (number) => {
      if (number.startsWith('0')) {
        return '256' + number.substring(1);
      }
      if (number.startsWith('+')) {
        return number.substring(1);
      }
      return number;
    };

    const isValidPhone = phoneRegex.test(cleanPhoneNumber);
    if (isValidPhone) {
      const standardizedPhone = formatPhoneNumber(cleanPhoneNumber);
      phoneNumber = standardizedPhone
    }
    return { status: isValidPhone, user_phone: phoneNumber }
  }
}