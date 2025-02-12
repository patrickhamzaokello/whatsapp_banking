import logger from "../config/logger.js";
import { SessionService } from "../services/session.service.js";
import { WhatsAppService } from "../services/whatsapp.service.js";
import messageQueue from "../queue/MessageQueue.js";
import { logIncomingMessage } from "../config/message-logger.js";
import { FlowService } from "../services/flow.service.js";
import database from "../config/database.js";
import path from "path";
import { MapGenerator } from "../services/map.service.js";
import fs from "fs";

export class MessageHandler {
  // Allowed contacts list moved to a class-level constant
  static ALLOWED_CONTACTS = [
    "256783604580",
    "256785866559",
    "256758662135",
    "256787250196",
    "256706943977",
    "256778687196",
    "256752493532",
    "256707675112",
    "256759552604",
    "256705054692",
    "256702547447",
    "256777676206",
    "256750785703",
    "256701259245",
    "256726078658",
    "256751531151",
    "256757104399",
    "256781533158",
    "256702769822",
  ];

  // Unified method for handling incoming messages via queue
  static async handleIncomingWithQueue(payload) {
    try {
      const { message, contact, businessPhoneNumberId } = payload;

      const userPhone = contact.wa_id;
      const userName = contact.profile.name;

      // Retrieve or create a session for the user
      let session =
        SessionService.getSession(userPhone) ||
        SessionService.createSession(userPhone, userName);
      session.resetTimeout();

      switch (message.type) {
        case "text":
          await this.processTextMessage(
            message,
            contact,
            businessPhoneNumberId,
            session
          );
          break;
        case "interactive":
          if (message.interactive.type === "list_reply") {
            await this.processListReply(
              message,
              contact,
              businessPhoneNumberId,
              session
            );
          }
          if (message.interactive.type === "nfm_reply") {
            await this.processFormReply(
              message,
              contact,
              businessPhoneNumberId,
              session
            );
          }
          break;
        case "location":
          await this.processLocationResponse(
            message,
            contact,
            businessPhoneNumberId,
            session
          );
          break;
        default:
          logger.warn("Unsupported message type received", { message });
      }
    } catch (error) {
      logger.error("Error in handleIncomingWithQueue", { error, payload });
      throw error;
    }
  }

  // Process standard text messages
  static async processTextMessage(
    message,
    contact,
    businessPhoneNumberId,
    session
  ) {
    try {
      const userPhone = contact.wa_id;
      const userName = contact.profile.name;
      const messageText = message.text.body.toLowerCase();

      // Create or retrieve user
      const userId = await database.getOrCreateUser(userPhone, userName);

      // Fetch handoff state using userId instead of userPhone
      const handoff_to_human = await database.determineUserMessageState(userId);

      // Log message
      await database.insertMessageLog(
        userId,
        message.id,
        messageText,
        "Inbound", // Incoming message
        userPhone
      );
      logIncomingMessage(userPhone, message.text.body);

      await this.sendSocketMessage(userPhone, userId, messageText);
      // Mark message as read
      await WhatsAppService.markMessageAsRead(
        businessPhoneNumberId,
        message.id
      );

      if (handoff_to_human) {
        // Mark message as read
        console.log("Handoff to human");
        // Human will respond, stop further bot processing
        return;
      }

      // Check if contact is allowed
      if (!this.ALLOWED_CONTACTS.includes(userPhone)) {
        await this.sendDevelopmentMessage(
          businessPhoneNumberId,
          userName,
          userPhone
        );
        return;
      }

      // Determine and process intent
      const intent = this.determineIntent(messageText);
      await this.processIntent(intent, message, session, businessPhoneNumberId);
    } catch (error) {
      logger.error("Error processing text message", { error, message });
      throw error;
    }
  }

  static async sendSocketMessage(userPhone, userId, messageContent) {
    // Input validation
    if (!userPhone || !userId || !messageContent) {
      throw new Error("userPhone, userId, and messageContent are required");
    }

    // Create the new message object with East Africa Time offset (+3)
    const newMessage = {
      id: Date.now().toString(),
      to_contact: userPhone,
      selected_user_id: userId,
      msg_source: userPhone,
      content: messageContent,
      timestamp: new Date(
        new Date().getTime() + 3 * 60 * 60 * 1000
      ).toISOString(),
    };

    const broadcast_data = {
      roomId: userId,
      message: newMessage,
    };

    // Send the message and handle the response
    try {
      const response = await WhatsAppService.sendMessageToSocket(
        broadcast_data
      );
      return response;
    } catch (error) {
      logger.error("Failed to send socket message", {
        userId,
        userPhone,
        error: error.message,
      });
    }
  }

  // process list reply from interactive message
  static async processListReply(
    message,
    contact,
    businessPhoneNumberId,
    session
  ) {
    try {
      // Mark message as read
      await WhatsAppService.markMessageAsRead(
        businessPhoneNumberId,
        message.id
      );
      const list_Id = message.interactive.list_reply.id;
      switch (list_Id) {
        case "pay_tax":
          await this.sendURATAXPaymentFlowMessage(
            "488798200691294",
            message,
            businessPhoneNumberId
          );
          break;
        case "pay_utilities":
          await this.sendBillsPaymentFlowMessage(
            "442394835264933",
            message,
            businessPhoneNumberId
          );
          break;
        case "open_account":
          await this.sendOpenAccountFlowMessage(
            "1819890832152763",
            message,
            businessPhoneNumberId
          );
          break;
        case "pay_merchant":
          await this.sendMerchantPaymentFlowMessage(
            "393839823814268",
            message,
            businessPhoneNumberId
          );
          break;
        case "report_complaint":
        case "send_inquiry":
          await this.sendCustomerSupportFlowMessage(
            "2102552853524929",
            message,
            businessPhoneNumberId
          );
          break;
        default:
          // Handle other button replies or send a default message
          await WhatsAppService.sendMessage(
            businessPhoneNumberId,
            contact.wa_id,
            "This service will be available soon",
            message.id
          );
      }
    } catch (error) {
      logger.error("Error processing list reply", { error, message });
      throw error;
    }
  }

  static async processLocationResponse(
    message,
    contact,
    businessPhoneNumberId,
    session
  ) {
    try {
      const { latitude, longitude } = message.location;

      const userPhone = contact.wa_id;
      const userName = contact.profile.name;
      await WhatsAppService.markMessageAsRead(
        businessPhoneNumberId,
        message.id
      );

      // generate the location html_page
      // Validate coordinate ranges
      if (
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return res.status(200).json({
          error: "Invalid coordinates",
        });
      }

      const lat = latitude;
      const lon = longitude;
      const zoom = 20;

      // Generate HTML
      const mapHTML = MapGenerator.generateMapHTML(lat, lon, zoom);
      const filename = `${userPhone}_map_${lat}_${lon}.html`;
      const filepath = path.join("/usr/src/app/src/public/maps", filename);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      fs.writeFileSync(filepath, mapHTML);
      const fileUrl = `/maps/${filename}`;

      const result = await database.insertOrUpdateUserLocation(
        userPhone,
        latitude.toString(),
        longitude.toString(),
        fileUrl
      );

      const user_message = `Dear ${userName}, \nThank you for submitting your form and location 🎉. We are verifying your details. \n\nWe’ll share your account credentials after verification. If needed, we’ll reach out for more details. Thank you!`;

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        userPhone,
        user_message,
        message.id
      );
    } catch (error) {
      logger.error("Error Processing location response", { error, message });
      throw error;
    }
  }

  // Process form replies
  static async processFormReply(
    message,
    contact,
    businessPhoneNumberId,
    session
  ) {
    try {
      // Mark message as read
      await WhatsAppService.markMessageAsRead(
        businessPhoneNumberId,
        message.id
      );
      await FlowService.flow_reply_processor(
        businessPhoneNumberId,
        message,
        contact,
        message.id
      );
    } catch (error) {
      logger.error("Error processing form reply", { error, message });
      throw error;
    }
  }

  // Existing methods remain the same
  static determineIntent(messageText) {
    const text = messageText.toLowerCase();
    return text.includes("pay") ? "PAYBILLS" : "MAINMENU";
  }

  static async processIntent(intent, message, session, businessPhoneNumberId) {
    session.resetState();
    await this.showServices(message, businessPhoneNumberId);
  }

  static async sendURATAXPaymentFlowMessage(
    flow_id,
    message,
    businessPhoneNumberId
  ) {
    const receiver_number = message.from;
    await FlowService.sendURATAXPaymentFlow(
      flow_id,
      receiver_number,
      businessPhoneNumberId
    );
  }

  static async sendBillsPaymentFlowMessage(
    flow_id,
    message,
    businessPhoneNumberId
  ) {
    const receiver_number = message.from;
    await FlowService.sendBillsPaymentFlow(
      flow_id,
      receiver_number,
      businessPhoneNumberId
    );
  }

  static async sendOpenAccountFlowMessage(
    flow_id,
    message,
    businessPhoneNumberId
  ) {
    const receiver_number = message.from;
    await FlowService.sendAccountOpenningFlow(
      flow_id,
      receiver_number,
      businessPhoneNumberId
    );
  }

  static async sendMerchantPaymentFlowMessage(
    flow_id,
    message,
    businessPhoneNumberId
  ) {
    const receiver_number = message.from;
    await FlowService.sendMerchantPaymentFlow(
      flow_id,
      receiver_number,
      businessPhoneNumberId
    );
  }

  static async sendCustomerSupportFlowMessage(
    flow_id,
    message,
    businessPhoneNumberId
  ) {
    const receiver_number = message.from;
    await FlowService.sendCustomerSupportFlow(
      flow_id,
      receiver_number,
      businessPhoneNumberId
    );
  }

  // Send development stage message
  static async sendDevelopmentMessage(
    businessPhoneNumberId,
    userName,
    userPhone
  ) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      userPhone,
      `Hello ${userName}, \nThis channel is still in development, please contact customer support via whatsapp on +256785866559 for assistance.`
    );
  }

  static async showServices(message, businessPhoneNumberId) {
    try {
      const message_body =
        "Effortless banking is just a tap away. Choose from a range of convenient services at your fingertips..";
      const data = await WhatsAppService.sendInteractiveListReplyMessage(
        message_body,
        message.from,
        businessPhoneNumberId
      );
      console.log(data);
    } catch (error) {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        "Temporarily Unavailable, Please try again",
        message.id
      );
      logger.error("Error sending interactive message", { error });
      throw error;
    }
  }

  static async validateEmail(email) {
    // RFC 5322 compliant email regex
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const isValidEmail = emailRegex.test(email);
    email = email.toLowerCase();
    return { status: isValidEmail, user_email: email };
  }

  static async validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^(?:256|\+256|0)?([17]\d{8}|[2-9]\d{8})$/;
    const cleanPhoneNumber = phoneNumber.replace(/[\s-]/g, "");
    const formatPhoneNumber = (number) => {
      if (number.startsWith("0")) {
        return "256" + number.substring(1);
      }
      if (number.startsWith("+")) {
        return number.substring(1);
      }
      return number;
    };

    const isValidPhone = phoneRegex.test(cleanPhoneNumber);
    if (isValidPhone) {
      const standardizedPhone = formatPhoneNumber(cleanPhoneNumber);
      phoneNumber = standardizedPhone;
    }
    return { status: isValidPhone, user_phone: phoneNumber };
  }
}
