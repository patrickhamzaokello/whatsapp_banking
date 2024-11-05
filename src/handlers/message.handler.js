import logger from '../config/logger.js';
import { SessionService } from '../services/session.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { PaymentService } from '../services/payment.service.js';
import { InputValidator } from '../validators/input.validator.js';
import { Helpers } from '../utils/helpers.js';

export class MessageHandler {
  static async handleIncoming(message, contact, businessPhoneNumberId) {
    try {
      const userPhone = contact.wa_id;
      const userName = contact.profile.name;

      let session = SessionService.getSession(userPhone) ||
        SessionService.createSession(userPhone, userName);

      session.resetTimeout();
      await WhatsAppService.markMessageAsRead(businessPhoneNumberId, message.id);
      const intent = this.determineIntent(message.text.body);
      await this.processIntent(intent, message, session, businessPhoneNumberId);

    } catch (error) {
      logger.error('Error handling incoming message', { error, message });
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
          await this.startServiceFlow(intent, message, session, businessPhoneNumberId);
          break;
        case 'CONFIRM':
          await this.handleConfirmation(message, session, businessPhoneNumberId);
          break;
        case 'MAINMENU':
          await this.showServices(message, session, businessPhoneNumberId);
          break;
        case 'PRCESSFLOWSTEPS':
          await this.processFlowStep(message, session, businessPhoneNumberId);
          break;
        default:
          session.resetState();
          await this.showServices(message, session, businessPhoneNumberId);
      }
    } catch (error) {
      logger.error('Error processing intent', { error, intent });
      throw error;
    }
  }

  static async processFlowStep(message, session, businessPhoneNumberId) {
    const text = message.text.body;
    const userName = session.userName;

    if (session.state.flowNextState === "validateTvNumber") {
      await this.validateTvNumber(text, message, session, userName, businessPhoneNumberId);
    } else if (session.state.flowNextState === "requestPhoneNumber") {
      if (text.toLowerCase() === "confirm") {
        await this.requestPhoneNumber(message, session, userName, businessPhoneNumberId);
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Please send 'confirm' to proceed.`,
          message.id
        );
      }
    } else if (session.state.flowNextState === "validatePhoneNumber") {
      await this.validatePhoneNumber(text, message, session, userName, businessPhoneNumberId);
    } else if (session.state.flowNextState === "validateWaterNumber") {
      await this.validateWaterNumber(text, message, session, userName, businessPhoneNumberId);
    } else if (session.state.flowNextState === "requestEmail") {
      if (text.toLowerCase() === "confirm") {
        await this.requestEmail(message, session, userName, businessPhoneNumberId);
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Please send 'confirm' to proceed.`,
          message.id
        );
      }
    } else if (session.state.flowNextState === "validateEmail") {
      await this.validateEmail(text, message, session, userName, businessPhoneNumberId);
    } else if (session.state.flowNextState === "validateMeterNumber") {
      await this.validateMeterNumber(text, message, session, userName, businessPhoneNumberId);
    } else if (session.state.flowNextState === "validatePrn") {
      await this.validatePrn(text, message, session, userName, businessPhoneNumberId);
    } else {
      await this.showServices(message, session, businessPhoneNumberId);
    }
  }

  static startServiceFlow(intent, message, session, businessPhoneNumberId) {
    const service = intent.split('_')[1].toLowerCase();
    session.state.currentService = service;
    const userName = session.userName;
    session.state.flowCompletedStates = [];
    session.state.flowNextState = service === "tv"
      ? "requestTvNumber"
      : service === "water"
        ? "requestWaterNumber"
        : service === "umeme"
          ? "requestMeterNumber"
          : "requestPrn";

    session.state.overallProgress = 0;

    if (service === "tv") {
      this.requestTvNumber(message, session, userName, businessPhoneNumberId);
    } else if (service === "water") {
      this.requestWaterNumber(message, session, userName, businessPhoneNumberId);
    } else if (service === "umeme") {
      this.requestMeterNumber(message, session, userName, businessPhoneNumberId);
    } else if (service === "prn") {
      this.requestPrn(message, session, userName, businessPhoneNumberId);
    } else {
      this.showServices(message, session, businessPhoneNumberId);
    }

  }

  static async requestTvNumber(message, session, username, businessPhoneNumberId) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `To pay for your TV subscription? 📺\n𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝘆𝗼𝘂𝗿 𝗧𝗩 𝗻𝘂𝗺𝗯𝗲𝗿.`,
      message.id
    );
    session.state.flowNextState = "validateTvNumber";
  }


  static async requestPhoneNumber(message, session, username, businessPhoneNumberId) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `Great! Now, please enter your mobile money phone number to proceed.`,
      message.id
    );
    session.state.flowNextState = "validatePhoneNumber";
  }

  static async requestMeterNumber(message, session, username, businessPhoneNumberId) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `Please enter your meter number.`,
      message.id
    );
    session.state.flowNextState = "validateMeterNumber";
  }

  static async requestWaterNumber(message, session, username, businessPhoneNumberId) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `Please enter your Water account number.`,
      message.id
    );
    session.state.flowNextState = "validateWaterNumber";
  }

  static async requestEmail(message, session, username, businessPhoneNumberId) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `Please enter your email address.`,
      message.id
    );
    session.state.flowNextState = "validateEmail";
  }

  static async requestPrn(message, session, username, businessPhoneNumberId) {
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `✨ Hi ${username}! To get started with your payment, \n\nCould you please enter your 𝗣𝗥𝗡 (Payment Reference Number)?`,
      message.id
    );
    session.state.flowNextState = "validatePrn";
  }

  static async validatePrn(prn, message, session, userName, businessPhoneNumberId) {
    if (prn === "PRN12345") {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `✨ I have found your PRN Details is ${prn}. \n\nPlease send '𝗰𝗼𝗻𝗳𝗶𝗿𝗺' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestPhoneNumber";
      session.attempts.prn = 0; // Reset attempts after successful validation
    } else {
      session.attempts.prn++;
      if (session.attempts.prn < 3) {

        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Invalid PRN. You have ${3 - session.attempts.prn
          } attempts left. Please try again.`,
          message.id
        );
      } else {

        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts ⚠. your session has ended.`
        );
        session.attempts.prn = 0; // Reset attempts after exceeding the limit
        session.resetState()
        this.showServices(message, session, businessPhoneNumberId); // Show the list of services
      }
    }
  }

  static async validateTvNumber(tvNumber, message, session, userName, businessPhoneNumberId) {
    if (tvNumber === "12345") {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Your TV number is ${tvNumber}. Please send 'confirm' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestPhoneNumber";
      session.attempts.tvNumber = 0; // Reset attempts after successful validation
    } else {
      session.attempts.tvNumber++;
      if (session.attempts.tvNumber < 3) {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Invalid TV number. You have ${3 - session.attempts.tvNumber
          } attempts left. Please try again.`,
          message.id
        );
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts. your session has ended.`
        );
        session.attempts.tvNumber = 0; // Reset attempts after exceeding the limit
        session.resetState();
        this.showServices(message, session, businessPhoneNumberId); // Show the list of services
      }
    }
  }

  static async validatePhoneNumber(phoneNumber, message, session, userName, businessPhoneNumberId) {
    if (phoneNumber === "9876543210") {
      // await sendMessage(
      //   message,
      //   `✨ Thank you! ${userName}, I have sent a payment prompt to your phone number: Please Authorize Payment to complete the transaction`,
      //   userName
      // );

      const m_service = session.state.currentService;
      const cleaned_name = InputValidator.replaceSpacesWithHyphens(userName);
      const cleaned_details = InputValidator.replaceSpacesWithHyphens(
        `Service Payment for ${m_service}`
      );

      const paymentDetails = await PaymentService.generatePaymentDetails(
        m_service,
        500, // Example amount
        session.userName,
        'default@email.com' // Replace with actual email
      );

      session.setPaymentDetails(paymentDetails);
      // // Generate and send payment link
      const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);


      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Thank you! ${userName}, Here is the payment link \n\n ${paymentLink} \n\n click on the link to complete the Payment for ${session.state.currentService}`
      );
      session.state.flowNextState = null;
      session.state.overallProgress = 100;
      session.attempts.phoneNumber = 0; // Reset attempts after successful validation
    } else {
      session.attempts.phoneNumber++;
      if (session.attempts.phoneNumber < 3) {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Invalid phone number. You have ${3 - session.attempts.phoneNumber
          } attempts left. Please try again.`,
          message.id
        );
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts. your session has ended.`
        );
        session.attempts.phoneNumber = 0; // Reset attempts after exceeding the limit
        session.resetState();
        this.showServices(message, session, businessPhoneNumberId); // Show the list of services
      }
    }

  }

  static async validateWaterNumber(waterNumber, message, session, userName, businessPhoneNumberId) {
    if (waterNumber === "67890") {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Your Water account number is ${waterNumber}. Please send 'confirm' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestEmail";
      session.attempts.waterNumber = 0; // Reset attempts after successful validation
    } else {
      session.attempts.waterNumber++;
      if (session.attempts.waterNumber < 3) {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Invalid Water account number. You have ${3 - session.attempts.waterNumber
          } attempts left. Please try again.`,
          message.id
        );
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts. your session has ended.`
        );
        session.attempts.waterNumber = 0; // Reset attempts after exceeding the limit
        session.resetState();
        this.showServices(message, session, businessPhoneNumberId); // Show the list of services
      }
    }

  }

  static async validateMeterNumber(meterNumber, message, session, userName, businessPhoneNumberId) {
    if (meterNumber === "54321") {

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Your meter number is ${meterNumber}. Please type 'confirm' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestPhoneNumber";
      session.attempts.meterNumber = 0; // Reset attempts after successful validation
    } else {
      session.attempts.meterNumber++;
      if (session.attempts.meterNumber < 3) {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Invalid meter number. You have ${3 - session.attempts.meterNumber
          } attempts left. Please try again.`,
          message.id
        );
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts. your session has ended.`
        );
        session.attempts.meterNumber = 0; // Reset attempts after exceeding the limit
        session.resetState();
        this.showServices(message, session, businessPhoneNumberId); // Show the list of services
      }
    }

  }

  static async validateEmail(email, message, session, userName, businessPhoneNumberId) {
    if (email === "user@example.com") {

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Here is your payment link: [Payment Link]`,
        message.id
      );
      session.state.flowNextState = null;
      session.state.overallProgress = 100;
      session.attempts.email = 0; // Reset attempts after successful validation
    } else {
      session.attempts.email++;
      if (session.attempts.email < 3) {

        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `Invalid email address. You have ${3 - session.attempts.email
          } attempts left. Please try again.`,
          message.id
        );
      } else {
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts. your session has ended.`
        );
        session.attempts.email = 0; // Reset attempts after exceeding the limit
        session.resetState();
        this.showServices(message, session, businessPhoneNumberId);// Show the list of services
      }
    }

  }

  /**
   * Determines the intent of the user's message based on keywords
   * @param {string} messageText - The text content of the message
   * @returns {string} The determined intent
   */
  static determineIntent(messageText) {
    const text = messageText.toLowerCase();

    if (text.includes('pay')) {
      if (text.includes('tv') || text.includes('television')) {
        return 'PAY_TV';
      }
      if (text.includes('water') || text.includes('nwsc')) {
        return 'PAY_WATER';
      }
      if (text.includes('electricity') || text.includes('power') || text.includes('yaka')) {
        return 'PAY_ELECTRICITY';
      }
      if (text.includes('prn') || text.includes('ura')) {
        return 'PAY_PRN';
      }
      if (text.includes('yes') || text.includes('confirm') || text.includes('proceed')) {
        return 'CONFIRM';
      }

      return 'UNKNOWN';
    } else if (text.includes('services') || text.includes('menu') || text.includes('home')) {
      return 'MAINMENU'
    } else {
      return 'PRCESSFLOWSTEPS'
    }


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
  static async showServices( message, session, businessPhoneNumberId) {
    const servicesMessage = 
    `Hello ${session.userName}, welcome to our payment service. Please choose a service to pay for using mobile money:\n\n` +
    `1. TV Subscription (GOTV & DSTV)\n` +
    `2. Water Bill (NWSC)\n` +
    `3. Electricity Bill (UMEME/YAKA)\n` +
    `4. URA Reference Number (PRN)\n\n` +
    `To proceed, reply with  "Pay TV," "Pay Water," "Pay Electricity," or "Pay PRN."\n\n` +
    `Thank you for choosing our service.`;   

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      servicesMessage,
      message.id
    );
  }
}