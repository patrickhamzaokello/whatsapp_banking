import logger from '../config/logger.js';
import { logOutgoingMessage } from '../config/message-logger.js';
import axios from 'axios';
import { config } from '../config/environment.js';
import { WhatsAppError } from '../errors/custom-errors.js';
import database from '../config/database.js';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';

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
        'o',               // Outgoing message
        'gtbank'  // Optional message source
      );

      logOutgoingMessage(to,message);

      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp message', { error, to, messageId });
      throw new WhatsAppError('Failed to send message');
    }
  }

  static async uploadWhatsappMedia(filePath) {
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(filePath), {
        filename: path.basename(filePath),
        contentType: 'application/pdf',
      });
      formData.append('type', 'application/pdf');
      formData.append('messaging_product', 'whatsapp');

      const response = await axios({
        method: "POST",
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/media`,
        data: formData,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`,
          'Content-Type': 'multipart/form-data'
        },
      });

      logger.info('Media Uploaded successfully', { filePath });
      return response.data;

    } catch (error) {
      logger.error('Error uploading media', { filePath, error });
      throw new WhatsAppError(error);
    }
  }

  static async sendTransactionReceipt(document_id, recepient_number, ReceiptCaption, ReceiptFilename) {
    try {
      const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recepient_number,
        type: "document",
        document: {
          id: document_id, /* Only if using uploaded media */
          caption: ReceiptCaption,
          filename: ReceiptFilename,
        }
      };

      const response = await axios({
        method: "POST",
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`
        },
        data
      });
      logger.info(`[response] User: ${recepient_number} - ReceiptID: ${document_id}`);
      logger.info('Receipt sent successfully', { recepient_number, document_id });
      return response.data;

    } catch (error) {
      logger.error('Error sending Receipt message', { error, recepient_number, document_id });
      throw new WhatsAppError('Failed to send Receipt');
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