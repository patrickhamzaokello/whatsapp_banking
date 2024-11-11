import logger from '../config/logger.js';
import { SessionService } from '../services/session.service.js';
import { PaymentService } from '../services/payment.service.js';
import { InputValidator } from '../validators/input.validator.js';
import { Helpers } from '../utils/helpers.js';
import { PRN_Validator } from '../validators/prns.validator.js';
import { PhoneNumber_Validator } from '../validators/phone_number.validator.js';
import Test_message_queue from '../queue/TestMessageQueue.js';

export class TestMessageHandler {
  static async handleIncomingWithQueue(message, contact, businessPhoneNumberId) {
    await Test_message_queue.enqueue(message, contact, businessPhoneNumberId);
  }
  
  static async handleIncoming(message, contact, businessPhoneNumberId) {
    try {
      const userPhone = contact.wa_id;
      const userName = contact.profile.name;

      let session = SessionService.getSession(userPhone) ||
        SessionService.createSession(userPhone, userName);

      session.resetTimeout();
      // await WhatsAppService.markMessageAsRead(businessPhoneNumberId, message.id);
      const intent = this.determineIntent(message.text.body);
      return await this.processIntent(intent, message, session, businessPhoneNumberId);

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
          return await this.startServiceFlow(intent, message, session, businessPhoneNumberId);
        case 'CONFIRM':
          return await this.handleConfirmation(message, session, businessPhoneNumberId);
        case 'MAINMENU':
          return await this.getServicesResponse(session);
        case 'PRCESSFLOWSTEPS':
          return await this.processFlowStep(message, session, businessPhoneNumberId);
        case 'USERINFOMESSAGE':
          return await this.getAssistantInfoResponse(message, session);
        default:
          session.resetState();
          return await this.getServicesResponse(session);
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

    const stepHandlers = {
      validateTvNumber: () => this.validateTvNumber(text, message, session, userName, businessPhoneNumberId),
      requestPhoneNumber: () => ({
        response: `${userName}, please enter the phone number that will be used to make the payment.`,
        flowState: "validatePhoneNumber"
      }),
      validatePhoneNumber: () => this.validatePhoneNumber(text, message, session, userName, businessPhoneNumberId),
      validateWaterNumber: () => this.validateWaterNumber(text, message, session, userName, businessPhoneNumberId),
      requestEmail: () => ({
        response: `Please enter your email address.`,
        flowState: "validateEmail"
      }),
      validateEmail: () => this.validateEmail(text, message, session, userName, businessPhoneNumberId),
      validateMeterNumber: () => this.validateMeterNumber(text, message, session, userName, businessPhoneNumberId),
      validatePrn: () => this.validatePrn(text, message, session, userName, businessPhoneNumberId),
      requestPaymentMethod: () => {
        if (text.toLowerCase() === "confirm") {
          return this.getPaymentMethodResponse(session);
        } else {
          return {
            response: `Please send 'confirm' to proceed.`,
            flowState: "requestPaymentMethod"
          };
        }
      },
      validatePaymentMethod: () => this.validatePaymentMethod(text, message, session, businessPhoneNumberId)
    };

    return stepHandlers[flowNextState] ? 
      await stepHandlers[flowNextState]() : 
      await this.getServicesResponse(session);
  }

  static startServiceFlow(intent, message, session, businessPhoneNumberId) {
    const service = intent.split('_')[1].toLowerCase();
    session.state.currentService = service;
    const userName = session.userName;
    session.state.flowCompletedStates = [];

    const nextStateMap = {
      tv: "validateTvNumber",
      water: "validateWaterNumber",
      umeme: "validateMeterNumber",
      prn: "validatePrn",
    };

    const messageMap = {
      tv: `To pay for your TV subscription? 📺\n𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝘆𝗼𝘂𝗿 𝗧𝗩 𝗻𝘂𝗺𝗯𝗲𝗿.`,
      water: `Please enter your Water account number.`,
      umeme: `Please enter your meter number.`,
      prn: `✨ Hi ${userName}! To get started with your payment, \n\nCould you please enter your 𝗣𝗥𝗡 (Payment Reference Number)?`,
    };

    session.state.flowNextState = nextStateMap[service];
    
    return {
      response: messageMap[service] || this.getServicesResponse(session).response,
      flowState: nextStateMap[service] || null
    };
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
      let message_from = message.from;
      let message_id = message.id;
     return paymentMessage, { businessPhoneNumberId, message_from, message_id };

      // Update session state
      session.state.flowNextState = "validatePaymentMethod";
      session.state.paymentOptions = paymentOptions.map(option => option.type.toLowerCase());

    } catch (error) {
      // Handle any errors
      console.error('Error in requestPaymentMethod:', error);

      const errorMessage =
        `Sorry ${userName}, we encountered an error while processing your request.\n` +
        `Please try again or contact support if the issue persists.`;



      let message_from = message.from;
      let message_id = message.id;
      return errorMessage, { businessPhoneNumberId, message_from, message_id };
    }
  }

  static async validatePaymentMethod(text, message, session, businessPhoneNumberId) {
    const choice = text.toLowerCase().trim();
    const validOptions = session.state.paymentOptions || ['card', 'mobile'];
  
    if (validOptions.includes(choice)) {
      session.state.paymentMethod = choice;
      const amount = session.getPaymentDetails()?.amount || 500;
  
      const confirmationMessage = {
        card: `You have selected Card Payment 💳\n\nAmount: UGX ${amount}\nService: ${session.state.currentService}\n\n`,
        mobile: `You have selected Mobile Payment 📱\n\nAmount: UGX ${amount}\nService: ${session.state.currentService}\n\n`
      };
  
      session.state.flowNextState = "finalizePayment";
      session.attempts.paymentMethod = 0;
  
      return {
        response: confirmationMessage[choice],
        flowState: choice === 'card' ? 'validateEmail' : 'validatePhoneNumber'
      };
    } else {
      session.attempts.paymentMethod = (session.attempts.paymentMethod || 0) + 1;
  
      if (session.attempts.paymentMethod < 3) {
        const remainingAttempts = 3 - session.attempts.paymentMethod;
        return {
          response: `Invalid payment method selection.\n\nPlease choose your payment method:\n• Reply with *Card* for card payment 💳\n• Reply with *Mobile* for Mobile Money payment 📱\n\nYou have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`,
          flowState: "validatePaymentMethod"
        };
      } else {
        session.attempts.paymentMethod = 0;
        session.resetState();
        return this.getServicesResponse(session);
      }
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

    let message_from = message.from;
    let message_id = message.id;
    session.state.flowNextState = "validateTvNumber";
    return `To pay for your TV subscription? 📺\n𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝘆𝗼𝘂𝗿 𝗧𝗩 𝗻𝘂𝗺𝗯𝗲𝗿.`, { businessPhoneNumberId, message_from, message_id };

  }


  static async requestPhoneNumber(message, session, username, businessPhoneNumberId) {

    let message_from = message.from;
    let message_id = message.id;


    session.state.flowNextState = "validatePhoneNumber";
    return `${username}, please enter the phone number that will be used to make the payment.`, { businessPhoneNumberId, message_from, message_id };

  }

  static async requestMeterNumber(message, session, username, businessPhoneNumberId) {

    let message_from = message.from;
    let message_id = message.id;
    session.state.flowNextState = "validateMeterNumber";
    return `Please enter your meter number.`, { businessPhoneNumberId, message_from, message_id };

  }

  static async requestWaterNumber(message, session, username, businessPhoneNumberId) {

    let message_from = message.from;
    let message_id = message.id;
    return `Please enter your Water account number.`, { businessPhoneNumberId, message_from, message_id };
    session.state.flowNextState = "validateWaterNumber";
  }

  static async requestEmail(message, session, username, businessPhoneNumberId) {

    let message_from = message.from;
    let message_id = message.id;
    return `Please enter your email address..`, { businessPhoneNumberId, message_from, message_id };
    session.state.flowNextState = "validateEmail";
  }

  static async requestPrn(message, session, username, businessPhoneNumberId) {
    let message_from = message.from;
    let message_id = message.id;
    return `✨ Hi ${username}! To get started with your payment, \n\nCould you please enter your 𝗣𝗥𝗡 (Payment Reference Number)?`, { businessPhoneNumberId, message_from, message_id };
    session.state.flowNextState = "validatePrn";
  }

  static async validatePrn(prn, message, session, userName, businessPhoneNumberId) {

    const validator = new PRN_Validator();
    await validator.validatePrn(prn, message, session, userName, businessPhoneNumberId)

  }

  static async validateTvNumber(tvNumber, message, session, userName, businessPhoneNumberId) {
    if (tvNumber === "12345") {
      session.state.flowNextState = "requestPaymentMethod";
      session.attempts.tvNumber = 0; // Reset attempts after successful validation
      
      return {
        response: `Your TV number is ${tvNumber}. Please send 'confirm' to proceed.`,
        flowState: "requestPaymentMethod"
      };
    } else {
      session.attempts.tvNumber = (session.attempts.tvNumber || 0) + 1;
      
      if (session.attempts.tvNumber < 3) {
        return {
          response: `Invalid TV number. You have ${3 - session.attempts.tvNumber} attempts left. Please try again.`,
          flowState: "validateTvNumber"
        };
      } else {
        session.attempts.tvNumber = 0; // Reset attempts after exceeding the limit
        session.resetState();
        return this.getServicesResponse(session); // Show the list of services
      }
    }
  }

  static async validateEmail(email, message, session, userName, businessPhoneNumberId) {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (emailRegex.test(email)) {
    try {
      session.state.userEmail = email;
      const serviceType = session.state.currentService;
      
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

      session.setPaymentDetails(sessionPaymentDetails);
      const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);

      const paymentMessage = 
        `Thank you ${session.userName}!\n\n` +
        `Here is the payment link, 👉 ` +
        `${paymentLink}\n\n` +
        `Click on the link above 👆 to pay using your bank card.\n\n` +
        `Email: ${email}\n` +
        `Paying for ${serviceType} with Card!`;

      session.state.flowNextState = null;
      session.state.overallProgress = 100;
      session.attempts.email = 0;

      return {
        response: paymentMessage,
        flowState: null
      };

    } catch (error) {
      return {
        response: "Sorry, we encountered an error processing your request. Please try again.",
        flowState: "validateEmail"
      };
    }
  } else {
    session.attempts.email = (session.attempts.email || 0) + 1;

    if (session.attempts.email < 3) {
      const remainingAttempts = 3 - session.attempts.email;
      return {
        response: `Invalid email address. You have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} left. Please provide a valid email address (e.g., user@example.com).`,
        flowState: "validateEmail"
      };
    } else {
      session.attempts.email = 0;
      session.resetState();
      return this.getServicesResponse(session);
    }
  }
}


  static async validatePhoneNumber(phoneNumber, message, session, userName, businessPhoneNumberId) {

    const phone_number_validator = new PhoneNumber_Validator();
    await phone_number_validator.validatePhonenumber(phoneNumber, message, session, userName, businessPhoneNumberId)

  }

  static async validateWaterNumber(waterNumber, message, session, userName, businessPhoneNumberId) {
    if (waterNumber === "67890") {
      session.state.flowNextState = "requestPaymentMethod";
      session.attempts.waterNumber = 0;
      
      return {
        response: `Your Water account number is ${waterNumber}. Please send 'confirm' to proceed.`,
        flowState: "requestPaymentMethod"
      };
    } else {
      session.attempts.waterNumber = (session.attempts.waterNumber || 0) + 1;
      
      if (session.attempts.waterNumber < 3) {
        return {
          response: `Invalid Water account number. You have ${3 - session.attempts.waterNumber} attempts left. Please try again.`,
          flowState: "validateWaterNumber"
        };
      } else {
        session.attempts.waterNumber = 0;
        session.resetState();
        return this.getServicesResponse(session);
      }
    }
  }

  static async validateMeterNumber(meterNumber, message, session, userName, businessPhoneNumberId) {
    if (meterNumber === "54321") {
      session.state.flowNextState = "requestPaymentMethod";
      session.attempts.meterNumber = 0;
      
      return {
        response: `Your meter number is ${meterNumber}. Please type 'confirm' to proceed.`,
        flowState: "requestPaymentMethod"
      };
    } else {
      session.attempts.meterNumber = (session.attempts.meterNumber || 0) + 1;
      
      if (session.attempts.meterNumber < 3) {
        return {
          response: `Invalid meter number. You have ${3 - session.attempts.meterNumber} attempts left. Please try again.`,
          flowState: "validateMeterNumber"
        };
      } else {
        session.attempts.meterNumber = 0;
        session.resetState();
        return this.getServicesResponse(session);
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

      let message_from = message.from;
      let message_id = message.id;
      return confirmationMessage, { businessPhoneNumberId, message_from, message_id };


      // Process the payment here
      await PaymentService.processPayment(session.state.paymentDetails);

      // Clear the session state after successful payment
      session.clearPaymentDetails();

    } catch (error) {
      return'Error handling confirmation', { error, sessionId: session.id };
      throw error;
    }
  }

  static getPaymentMethodResponse(session) {
    const paymentOptions = [
      { type: 'Card', emoji: '💳', description: 'Visa/Mastercard payment' },
      { type: 'Mobile', emoji: '📱', description: 'MTM/Airtel payment' }
    ];

    const paymentMessage =
      `Hello ${session.userName},\n\n` +
      `Please choose your preferred payment method:\n\n` +
      paymentOptions.map(option =>
        `*${option.type}* ${option.emoji}\n` +
        `└ ${option.description}`
      ).join('\n\n') +
      '\n\nReply with either *Card* or *Mobile* to proceed.';

    return {
      response: paymentMessage,
      flowState: "validatePaymentMethod"
    };
  }

  static getServicesResponse(session) {
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

    return {
      response: servicesMessage,
      flowState: null
    };
  }

  static getAssistantInfoResponse(message, session) {
    const infoMessage =
      `Hello, ${session.userName} 👋 Welcome to GTbank Uganda's Online Assistant.\n\n` +
      `I'm here to help with your banking needs and transactions via WhatsApp.\n\n` +
      `To begin, reply with:\n` +
      `📞 (Contact) \n` +
      `🌐 (About) \n` +
      `🧩 (FAQ) \n\n` +
      `Thank you for choosing GTbank! \n\n` +
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
      `We're here to assist with any inquiries!`;

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

    const message_text = message.text.body.toLowerCase();
    let responseMessage;

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

    return {
      response: responseMessage,
      flowState: null
    };
  }
}