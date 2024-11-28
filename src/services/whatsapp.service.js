import logger from '../config/logger.js';
import { logOutgoingMessage } from '../config/message-logger.js';
import axios from 'axios';
import { config } from '../config/environment.js';
import { WhatsAppError } from '../errors/custom-errors.js';
import database from '../config/database.js';

export class WhatsAppService {
  static async sendMessage(phoneNumberId, to, message, messageId = null) {
    try {
      const data = {
        messaging_product: "whatsapp",
        to,
        text: { body: message }
      };

      if (messageId) {
        data.context = { message_id: messageId };
      }

      const response = await axios({
        method: "POST",
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`
        },
        data
      });

      const userId = await database.getOrCreateUser(to, "userName");

      const message_db_id = await database.insertMessageLog(
        userId, 
        messageId, 
        message, 
        2,               // Outgoing message
        'gtbank'  // Optional message source
      );

      logOutgoingMessage(to,message);

      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp message', { error, to, messageId });
      throw new WhatsAppError('Failed to send message');
    }
  }

  static async markMessageAsRead(phoneNumberId, messageId) {
    try {
      await axios({
        method: "POST",
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`
        },
        data: {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId
        }
      });


    } catch (error) {
      logger.error('Error marking message as read', { error, messageId });
      throw new WhatsAppError('Failed to mark message as read');
    }
  }
}