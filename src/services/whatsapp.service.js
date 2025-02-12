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

      await database.insertMessageLog(
        userId,
        messageId,
        message,
        'Outbound',               // Outgoing message
        'gtbank'  // Optional message source
      );

      logOutgoingMessage(to, message);

      return response.data;

    } catch (error) {
      logger.error('Error sending WhatsApp message', { error, to, messageId });
      throw new WhatsAppError('Failed to send message');
    }
  }

  static async sendManualMessage(to, message, messageId = null) {
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
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${config.whatsapp.phoneNumberId}/messages`,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`
        },
        data
      });

      console.log(to, message, messageId);


      const userId = await database.getOrCreateUser(to, "userName");

      await database.insertMessageLog(
        userId,
        messageId,
        message,
        'Outbound',               // Outgoing message
        'gtbank'  // Optional message source
      );


      logOutgoingMessage(to, message);

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

  static async sendLocationRequestMessage(recepient_number, message_body) {
    try {
      const data = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        type: "interactive",
        to: recepient_number,
        interactive: {
          type: "location_request_message",
          body: {
            text: message_body
          },
          action: {
            "name": "send_location"
          }
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
      logger.info(`[response] User: ${recepient_number} - Location Request`);
      logger.info('Location request sent successfully', { recepient_number });
    }
    catch (error) {
      logger.error('Error sending Receipt message', { error, recepient_number, message_body });
      throw new WhatsAppError('Failed to send Receipt');
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

  static async sendMessageToSocket(broadcast_data) {
    try {
      const response = await axios({
        method: "POST",
        url: `http://chat_socket_server:4000/chat_server/broadcast`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: broadcast_data,
        timeout: 5000 // 5 second timeout
      });

      return response.data;
    } catch (error) {
      logger.error('Error sending broadcast message to socket', {
        error,
        roomId: broadcast_data?.roomId
      });
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

  static async sendInteractiveListReplyMessage(body_message, recipientPhoneNumber, phoneNumberId) {
    const flowPayload = {
      type: "list",
      header: {
        type: "text",
        text: "Main Menu"
      },
      body: {
        text: "Welcome to GTBank Uganda digital channel 🌟. Click 'show services' to see what you can do here."
      },
      footer: {
        text: "Guaranty Trust Bank Uganda Ltd"
      },
      action: {
        button: "Show Services",
        sections: [
          {
            title: "Main Menu",
            rows: [
              {
                id: "pay_tax",
                title: "Pay Taxes",
                description: "Settle government tax payments quickly and easily."
              },
              {
                id: "pay_utilities",
                title: "Pay Utilities",
                description: "Pay for electricity, water, and other essential services."
              },
              {
                id: "pay_merchant",
                title: "Pay a Merchant",
                description: "Make secure payments to your trusted merchants."
              },
              {
                id: "open_account",
                title: "Open an Account",
                description: "Start your journey with GTBank by opening a new account."
              },

            ]
          },
          {
            title: "Customer support",
            rows: [

              {
                id: "report_complaint",
                title: "Report a Complaint",
                description: "Let us know about any issues for prompt assistance."
              }
              ,
              {
                id: "send_inquiry",
                title: "Send an Inquiry",
                description: "Get answers to your banking questions and concerns."
              }
            ]
          }
        ]
      }
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhoneNumber,
      type: 'interactive',
      interactive: flowPayload
    };

    try {
      const response = await axios({
        method: "POST",
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`
        },
        data: payload
      });

      return response.data;
    }
    catch (error) {
      logger.error('Error sending WhatsApp Interactive message', { recipientPhoneNumber, error });
      throw new WhatsAppError('Failed to send interactive message');
    }

  }

  static async sendInteractionButtonMessage(body_message, recipientPhoneNumber, phoneNumberId) {

    const flowPayload = {
      type: "button",
      header: {
        type: "image",
        // image: {
        //     id: "1341154620579603" // # update this every month
        // }
        image: {
          link: "https://socialbanking.gtbank.co.ug/flow_images/welcome_script.png"
        }
      },
      body: {
        text: body_message
      },
      footer: {
        text: "© 2024 Guaranty Trust Bank, Uganda."
      },
      action: {
        buttons: [
          {
            "type": "reply",
            "reply": {
              "id": "payService",
              "title": "Pay Bills"
            }
          }
          , {
            "type": "reply",
            "reply": {
              "id": "payMerchant",
              "title": "Pay Merchant"
            }
          },
          {
            "type": "reply",
            "reply": {
              "id": "openAnAccount",
              "title": "Open Account"
            }
          }
        ]
      }
    }
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: recipientPhoneNumber,
      type: 'interactive',
      interactive: flowPayload
    };

    try {
      const response = await axios({
        method: "POST",
        url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
        headers: {
          Authorization: `Bearer ${config.webhook.graphApiToken}`
        },
        data: payload
      });

      return response.data;
    }
    catch (error) {
      logger.error('Error sending WhatsApp Interactive message', { recipientPhoneNumber, error });
      throw new WhatsAppError('Failed to send interactive message');
    }
  }






}

