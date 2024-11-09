import logger from '../config/logger.js';
import { SessionService } from '../services/session.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { PaymentService } from '../services/payment.service.js';
import { InputValidator } from '../validators/input.validator.js';
import { Helpers } from '../utils/helpers.js';
import { PRN_Validator } from '../validators/prns.validator.js';
import { PhoneNumber_Validator } from '../validators/phone_number.validator.js';

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
        case 'PAY_UMEME':
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
        case 'USERINFOMESSAGE':
          await this.showAssistantInfo(message, session, businessPhoneNumberId);
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
    const flowNextState = session.state.flowNextState;

    switch (flowNextState) {
      case "validateTvNumber":
        await this.validateTvNumber(
          text,
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "requestPhoneNumber":
        await this.requestPhoneNumber(
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "validatePhoneNumber":
        await this.validatePhoneNumber(
          text,
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "validateWaterNumber":
        await this.validateWaterNumber(
          text,
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "requestEmail":
        await this.requestEmail(
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "validateEmail":
        await this.validateEmail(
          text,
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "validateMeterNumber":
        await this.validateMeterNumber(
          text,
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;

      case "validatePrn":
        await this.validatePrn(
          text,
          message,
          session,
          userName,
          businessPhoneNumberId
        );
        break;
      case "requestPaymentMethod":
        if (text.toLowerCase() === "confirm") {
          await this.requestPaymentMethod(message, session, userName, businessPhoneNumberId);
        } else {
          await WhatsAppService.sendMessage(
            businessPhoneNumberId,
            message.from,
            `Please send 'confirm' to proceed.`,
            message.id
          );
        }
        break;
      case "validatePaymentMethod":
        await this.validatePaymentMethod(text, message, session, businessPhoneNumberId);
        break;

      default:
        await this.showServices(
          message,
          session,
          businessPhoneNumberId
        );
        break;
    }
  }

  static startServiceFlow(intent, message, session, businessPhoneNumberId) {
    const service = intent.split('_')[1].toLowerCase();
    session.state.currentService = service;
    const userName = session.userName;
    session.state.flowCompletedStates = [];

    const nextStateMap = {
      tv: "requestTvNumber",
      water: "requestWaterNumber",
      umeme: "requestMeterNumber",
      prn: "requestPrn",
    };

    session.state.flowNextState = nextStateMap[service] || null;

    switch (service) {
      case "tv":
        this.requestTvNumber(message, session, userName, businessPhoneNumberId);
        break;
      case "water":
        this.requestWaterNumber(message, session, userName, businessPhoneNumberId);
        break;
      case "umeme":
        this.requestMeterNumber(message, session, userName, businessPhoneNumberId);
        break;
      case "prn":
        this.requestPrn(message, session, userName, businessPhoneNumberId);
        break;
      default:
        this.showServices(message, session, businessPhoneNumberId);
    }
  }

  static async requestPaymentMethod(message, session, userName, businessPhoneNumberId) {
    try {
      const paymentOptions = [
        { type: 'Card', emoji: '💳', description: 'Visa/Mastercard payment' },
        { type: 'Mobile', emoji: '📱', description: 'MTM/Airtel payment' }
      ];

      // Format payment options message
      const paymentMessage =
        `Hello ${userName},\n\n` +
        `Please choose your preferred payment method:\n\n` +
        paymentOptions.map(option =>
          `*${option.type}* ${option.emoji}\n` +
          `└ ${option.description}`
        ).join('\n\n') +
        '\n\nReply with either *Card* or *Mobile* to proceed.';

      // Send payment options message
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        paymentMessage,
        message.id
      );

      // Update session state
      session.state.flowNextState = "validatePaymentMethod";
      session.state.paymentOptions = paymentOptions.map(option => option.type.toLowerCase());

    } catch (error) {
      // Handle any errors
      console.error('Error in requestPaymentMethod:', error);

      const errorMessage =
        `Sorry ${userName}, we encountered an error while processing your request.\n` +
        `Please try again or contact support if the issue persists.`;

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        errorMessage,
        message.id
      );
    }
  }

  static async validatePaymentMethod(text, message, session, businessPhoneNumberId) {
    try {
      const choice = text.toLowerCase().trim();
      // const validOptions = session.state.paymentOptions || ['card', 'mobile'];
      const validOptions = session.state.paymentOptions

      if (validOptions.includes(choice)) {
        // Store the payment method in session
        session.state.paymentMethod = choice;

        // Prepare confirmation message based on payment method
        const confirmationMessage = {
          card:
            `You have selected Card Payment 💳\n\n` +
            `Amount: UGX ${session.getPaymentDetails()?.amount || 500}\n` +
            `Service: ${session.state.currentService}\n\n`,
          mobile:
            `You have selected Mobile Payment 📱\n\n` +
            `Amount: UGX ${session.getPaymentDetails()?.amount || 500}\n` +
            `Service: ${session.state.currentService}\n\n`
        };

        // Send confirmation message
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          confirmationMessage[choice],
          message.id
        );

        // Update session state
        session.state.flowNextState = "finalizePayment";
        session.attempts.paymentMethod = 0;

        // Proceed to payment finalization
        await this.finalizePayment(message, session, businessPhoneNumberId);

      } else {
        // Handle invalid payment method selection
        session.attempts.paymentMethod = (session.attempts.paymentMethod || 0) + 1;

        if (session.attempts.paymentMethod < 3) {
          const remainingAttempts = 3 - session.attempts.paymentMethod;
          const errorMessage =
            `Invalid payment method selection.\n\n` +
            `Please choose your payment method:\n` +
            `• Reply with *Card* for card payment 💳\n` +
            `• Reply with *Mobile* for Mobile Money payment 📱\n\n` +
            `You have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`;

          await WhatsAppService.sendMessage(
            businessPhoneNumberId,
            message.from,
            errorMessage,
            message.id
          );
        } else {
          // Reset session after maximum attempts
          const sessionEndedMessage =
            `You have exceeded the maximum number of attempts.\n` +
            `Your session has been reset. Please start over to try again.`;

          await WhatsAppService.sendMessage(
            businessPhoneNumberId,
            message.from,
            sessionEndedMessage,
            message.id
          );

          session.attempts.paymentMethod = 0;
          session.resetState();
          await this.showServices(message, session, businessPhoneNumberId);
        }
      }
    } catch (error) {
      // Handle any errors during validation
      console.error('Error in validatePaymentMethod:', error);

      const errorMessage =
        `Sorry, we encountered an error processing your payment method selection.\n` +
        `Please try again or contact support if the issue persists.`;

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        errorMessage,
        message.id
      );

      // Reset session state on error
      session.state.flowNextState = "requestPaymentMethod";
    }
  }

  static async finalizePayment(message, session, businessPhoneNumberId) {
    const paymentMethod = session.state.paymentMethod;
    if (paymentMethod === "card") {
      await this.requestEmail(message, session, session.userName, businessPhoneNumberId);
    } else if (paymentMethod === "mobile") {
      await this.requestPhoneNumber(message, session, session.userName, businessPhoneNumberId);
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
      `${username}, please enter the phone number that will be used to make the payment.`,
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

    const validator = new PRN_Validator();
    await validator.validatePrn(prn, message, session, userName, businessPhoneNumberId)

  }

  static async validateTvNumber(tvNumber, message, session, userName, businessPhoneNumberId) {
    if (tvNumber === "12345") {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Your TV number is ${tvNumber}. Please send 'confirm' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestPaymentMethod";
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

  static async validateEmail(email, message, session, userName, businessPhoneNumberId) {
    // RFC 5322 compliant email regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    const isValidEmail = emailRegex.test(email);

    if (isValidEmail) {
      try {
        // Store valid email
        session.state.userEmail = email;
        const serviceType = session.state.currentService;

        // Generate payment details
        const paymentDetails = await PaymentService.generatePaymentDetails(
          serviceType,
          500,
          session.userName,
          email
        );
        const sessionPaymentDetails = {
          amount: paymentDetails.amount,
          service: paymentDetails.serviceType,
          userName: paymentDetails.userName,
          email: paymentDetails.userEmail
        };

        // Set payment details and generate link
        session.setPaymentDetails(sessionPaymentDetails);
        const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);

        // Construct payment message
        const paymentMessage =
          `Thank you ${session.userName}!\n\n` +
          `Here is the payment link, 👉 ` +
          `${paymentLink}\n\n` +
          `Click on the link above 👆 to pay using your bank card.\n\n` +
          `Email: ${email}\n` +
          `Paying for ${serviceType} with Card!`;

        // Send payment information
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          paymentMessage
        );

        // Reset flow state
        session.state.flowNextState = null;
        session.state.overallProgress = 100;
        session.attempts.email = 0;

      } catch (error) {
        // Handle any payment service errors
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          "Sorry, we encountered an error processing your request. Please try again."
        );
        console.error('Payment processing error:', error);
      }
    } else {
      // Handle invalid email attempts
      session.attempts.email = (session.attempts.email || 0) + 1;

      if (session.attempts.email < 3) {
        const remainingAttempts = 3 - session.attempts.email;
        const attemptsMessage =
          `Invalid email address. ` +
          `You have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} left. ` +
          `Please provide a valid email address (e.g., user@example.com).`;

        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          attemptsMessage,
          message.id
        );
      } else {
        // Reset session after maximum attempts
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          "You have exceeded the maximum number of attempts. Your session has ended."
        );

        session.attempts.email = 0;
        session.resetState();
        await this.showServices(message, session, businessPhoneNumberId);
      }
    }
  }



  static async validatePhoneNumber(phoneNumber, message, session, userName, businessPhoneNumberId) {

    const phone_number_validator = new PhoneNumber_Validator();
    await phone_number_validator.validatePhonenumber(phoneNumber, message, session, userName, businessPhoneNumberId)
    
  }

  static async validateWaterNumber(waterNumber, message, session, userName, businessPhoneNumberId) {
    if (waterNumber === "67890") {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Your Water account number is ${waterNumber}. Please send 'confirm' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestPaymentMethod";
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
      session.state.flowNextState = "requestPaymentMethod";
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
      if (text.includes('umeme') || text.includes('power') || text.includes('yaka')) {
        return 'PAY_UMEME';
      }
      if (text.includes('prn') || text.includes('ura')) {
        return 'PAY_PRN';
      }
      if (text.includes('yes') || text.includes('confirm') || text.includes('proceed')) {
        return 'CONFIRM';
      }
      return 'UNKNOWN';
    } else if (text.includes('contact') || text.includes('faq') || text.includes('about')) {
      return 'USERINFOMESSAGE'
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
  static async showServices(message, session, businessPhoneNumberId) {
    const servicesMessage =
      `Hello ${session.userName}, \n\n` +
      `Pay TV Subscription (GOTV & DSTV)\n` +
      `Pay Water Bill (NWSC)\n` +
      `Pay Electricity Bill (UMEME/YAKA)\n` +
      `Pay URA Reference Number (PRN)\n\n` +
      `👉 *To proceed, reply with  "Pay TV," "Pay Water," "Pay Yaka," or "Pay PRN.*"\n\n` +
      `© 2024 Guaranty Trust Bank, Uganda. All Rights Reserved.\n\n\n` +
     `For more info, reply with text below:\n` +
      `📞 (Contact) \n` +
      `🌐 (About) \n` +
      `🧩 (FAQ) \n\n`;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      servicesMessage,
      message.id
    );
  }

  static async showAssistantInfo(message, session, businessPhoneNumberId) {
    const infoMessage =
      `Hello, ${session.userName} 👋 Welcome to GTbank Uganda's Online Assistant.\n\n` +
      `I'm here to help with your banking needs and transactions via WhatsApp.\n\n` +
      `To begin, reply with:\n` +
      `📞 (Contact) \n` +
      `🌐 (About) \n` +
      `🧩 (FAQ) \n\n` +
      `Thank you for choosing GTbank! \n\n`+
      `© 2024 Guaranty Trust Bank, Uganda. All Rights Reserved`;

    const contactMessage =
      `Need help? Reach us through:\n\n` +
      `📞 **Phone:**\n` +
      `- Customer Service: +256-200-710-500, +256-703-718-500\n` +
      `- Support: +256-785-866-559\n\n` +
      `🌐 **Website:** https://www.gtbank.co.ug/ \n\n` +
      `📍 **Address:**\n` +
      `Plot 56 Kira Road.\nP O Box 7323 Kampala, Uganda.\n\n` +
      `✉️ **Email:** support@gtbank.com\n\n` +
      `We’re here to assist with any inquiries!`;

    const faqMessage =
      `GTbank Online Assistant FAQs:\n\n` +
      `**1. Available Services:**\n` +
      `- URA (PRN)\n` +
      `- National Water (NWSC)\n` +
      `- Electricity (UMEME/YAKA)\n` +
      `- TV (GOTV & DSTV)\n\n` +
      `**2. Making Payments:**\n` +
      `Reply with the service number or type (e.g., "Pay TV").\n\n` +
      `**3. Payment Options:**\n` +
      `All payments are processed through mobile money or bank cards.\n\n` +
      `**4. Further Assistance:**\n` +
      `Reply with "Contact us" or visit our website for support.\n\n` +
      `**5. Security:**\n` +
      `Your payment information is secure with us.\n\n` +
      `Have other questions? Just ask!`;


    let responseMessage;

    const message_text = message.text.body.toLowerCase()

    switch (message_text) {
      case 'contact':
        responseMessage = contactMessage;
        break;

      case 'faq':
        responseMessage = faqMessage;
        break;

      default:
        responseMessage = infoMessage;
        break;
    }

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      responseMessage,
      message.id
    );
  }
}