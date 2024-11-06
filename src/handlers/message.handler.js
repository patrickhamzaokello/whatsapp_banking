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
    // Prompt user to choose between card or mobile payment
    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      `Please choose your payment method:\nType "Card" for card payments 💳\nType "Mobile" for mobile payments 📱`,
      message.id
    );
    session.state.flowNextState = "validatePaymentMethod"; // Set the next state
  }

  static async validatePaymentMethod(text, message, session, businessPhoneNumberId) {
    const choice = text.toLowerCase();
    if (choice === "card" || choice === "mobile") {
      // Store user’s payment method choice
      session.state.paymentMethod = choice;
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `You selected ${choice === "card" ? "Card" : "Mobile"} payment. Proceeding...`,
        message.id
      );
      session.state.flowNextState = "finalizePayment"; // Move to the final payment step
      await this.finalizePayment(message, session, businessPhoneNumberId);
    } else {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Invalid choice. Please type "Card" or "Mobile" to choose your payment method.`,
        message.id
      );
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
    if (prn === "PRN12345") {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `✨ I have found your PRN Details is ${prn}. \n\nPlease send '𝗰𝗼𝗻𝗳𝗶𝗿𝗺' to proceed.`,
        message.id
      );
      session.state.flowNextState = "requestPaymentMethod";
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
    if (email === "user@example.com") {
      session.state.userEmail = email;
      const m_service = session.state.currentService;
      const m_email = session.state.userEmail;

      const paymentDetails = await PaymentService.generatePaymentDetails(
        m_service,
        500,
        session.userName,
        m_email
      );

      session.setPaymentDetails(paymentDetails);
      const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Here is the payment link, ${session.userName} 👇 \n\n ${paymentLink} \n\n Click on the link above 👆 to paying using your bank card.\n\n Email: ${m_email} \n Paying for ${session.state.currentService} with Card! `
      );
      session.state.flowNextState = null;
      session.state.overallProgress = 100;
      session.attempts.email = 0;
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
      `Hello ${session.userName}, welcome to our payment service. Please choose a service to pay for using mobile money:\n\n` +
      `1. TV Subscription (GOTV & DSTV)\n` +
      `2. Water Bill (NWSC)\n` +
      `3. Electricity Bill (UMEME/YAKA)\n` +
      `4. URA Reference Number (PRN)\n\n` +
      `To proceed, reply with  "Pay TV," "Pay Water," "Pay Electricity," or "Pay PRN."\n\n` +
      `Thank you for choosing our service.\n\n\n` +
      `1. Contact\n` +
      `2. FAQ\n` +
      `3. About\n`;;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      servicesMessage,
      message.id
    );
  }

  static async showAssistantInfo(message, session, businessPhoneNumberId) {
    const infoMessage =
      `Hello! ${session.userName} 👋 Welcome to the GTbank Online Assistant.\n\n` +
      `I am here to assist you with your banking needs, provide information about our services, and help you with transactions directly through WhatsApp.\n\n` +
      `For the best experience, please ensure you are using the official WhatsApp app, available on the Google Play Store or Apple App Store.\n\n` +
      `To get started, reply with:\n` +
      `1. To contact us directly\n` +
      `2. To read our Frequently Asked Questions (FAQ)\n\n` +
      `Thank you for choosing GTbank!`;

    const contactMessage =
      `For assistance, you can reach us through the following channels:\n\n` +
      `📞 **Phone Numbers:**\n` +
      `- Customer Service: +123-456-7890\n` +
      `- Support: +123-456-7891\n\n` +
      `🌐 **Website:** [www.gtbank.com](http://www.gtbank.com)\n\n` +
      `📍 **Location Address:**\n` +
      `GTbank Head Office, \n` +
      `123 Banking St, \n` +
      `City, Country\n\n` +
      `✉️ **Email:** support@gtbank.com\n\n` +
      `We are here to help you with any inquiries you may have!`;


    const faqMessage =
      `Frequently Asked Questions (FAQ) about Services:\n\n` +
      `**1. What services can I pay for using the GTbank Online Assistant?**\n` +
      `You can pay for the following services directly through the assistant:\n` +
      `- TV Subscription (GOTV & DSTV)\n` +
      `- Water Bill (NWSC)\n` +
      `- Electricity Bill (UMEME/YAKA)\n` +
      `- URA Reference Number (PRN)\n\n` +
      `**2. How do I make a payment?**\n` +
      `Simply reply with the number corresponding to the service you wish to pay for, or type the service name (e.g., "Pay TV").\n\n` +
      `**3. Can I use mobile money for payments?**\n` +
      `Yes, all payments are processed through mobile money for your convenience.\n\n` +
      `**4. What if I need further assistance?**\n` +
      `If you need help beyond these services, you can reply with "Contact us" for direct support or check our website for more information.\n\n` +
      `**5. Is my payment information secure?**\n` +
      `Absolutely! We take your security seriously and use secure payment processes to protect your information.\n\n` +
      `If you have any other questions, feel free to ask!`;

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