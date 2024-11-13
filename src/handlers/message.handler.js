import logger from '../config/logger.js';
import { SessionService } from '../services/session.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
import { PaymentService } from '../services/payment.service.js';
import { InputValidator } from '../validators/input.validator.js';
import { Helpers } from '../utils/helpers.js';
import { PRN_Validator } from '../validators/prns.validator.js';
import { PhoneNumber_Validator } from '../validators/phone_number.validator.js';
import messageQueue from '../queue/MessageQueue.js';

export class MessageHandler {
  static CONTROL_COMMANDS = {
    CANCEL: ['cancel', 'stop', 'exit'],
    CHANGE_PAYMENT: ['change payment', 'switch payment', 'different payment'],
    HELP: ['help', 'support', '?'],
    START_OVER: ['start over', 'restart', 'begin again']
  };

  static PAYMENT_METHOD_STATES = [
    'validatePaymentMethod',
    'requestPaymentMethod',
    'validateEmail',
    'validatePhoneNumber',
    // 'finalizePayment'
  ];

  static async handleIncomingWithQueue(message, contact, businessPhoneNumberId) {
    await messageQueue.enqueue(message, contact, businessPhoneNumberId);
  }

  static async handleIncoming(message, contact, businessPhoneNumberId) {
    try {
      const userPhone = contact.wa_id;
      const userName = contact.profile.name;
      const messageText = message.text.body.toLowerCase();

      logger.info(`[incoming] User: ${contact.wa_id} - Message: ${message.text.body}`);

      let session = SessionService.getSession(userPhone) ||
        SessionService.createSession(userPhone, userName);

      session.resetTimeout();
      await WhatsAppService.markMessageAsRead(businessPhoneNumberId, message.id);

      // check for control commands first
      if (await this.handleControlCommands(messageText, message, session, businessPhoneNumberId)) {
        return; // Control command was handled, exit
      }

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


  static async handleControlCommands(messageText, message, session, businessPhoneNumberId) {
    // Check for cancel command
    if (this.CONTROL_COMMANDS.CANCEL.includes(messageText)) {
      await this.cancelTransaction(message, session, businessPhoneNumberId);
      return true;
    }

    // Check for change payment method command
    if (this.CONTROL_COMMANDS.CHANGE_PAYMENT.includes(messageText)) {
      await this.handlePaymentMethodChange(message, session, businessPhoneNumberId);
      return true;
    }

    // Check for help command
    if (this.CONTROL_COMMANDS.HELP.includes(messageText)) {
      await this.showHelpMessage(message, session, businessPhoneNumberId);
      return true;
    }

    // Check for start over command
    if (this.CONTROL_COMMANDS.START_OVER.includes(messageText)) {
      await this.startOver(message, session, businessPhoneNumberId);
      return true;
    }

    return false; // No control command matched
  }


  static async cancelTransaction(message, session, businessPhoneNumberId) {
    const cancelMessage =
      `Transaction cancelled.\n\n` +
      `Thank you for using GTBank services. Would you like to:\n\n` +
      `[pay **service** ]. Start a new transaction\n` +
      `[menu]. Return to main menu\n\n` +
      `Reply to proceed.`;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      cancelMessage,
      message.id
    );

    // Save the previous state in case user wants to resume
    session.state.previousState = { ...session.state };
    session.resetState();
    session.state.flowNextState = "handleCancellation";
  }

  static async handlePaymentMethodChange(message, session, businessPhoneNumberId) {
    // Check if user has reached payment method step
    const hasReachedPaymentStep = session.state.flowCompletedStates?.includes('requestPaymentMethod') ||
      this.PAYMENT_METHOD_STATES.includes(session.state.flowNextState);

    if (!session.state.currentService) {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        "No active transaction found. Please start a new transaction.",
        message.id
      );
      return;
    }

    if (!hasReachedPaymentStep) {
      const currentStep = session.state.flowNextState;
      const stepMessage = this.getStepDescription(currentStep);

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `You haven't reached the payment method selection step yet. ` +
        `Please complete the current step first (${stepMessage}).\n\n` +
        `You can type "help" to see available commands.`,
        message.id
      );
      return;
    }

    // If we've reached here, user can change payment method
    await this.changePaymentMethod(message, session, businessPhoneNumberId);
  }

  static getStepDescription(step) {
    const stepDescriptions = {
      validateTvNumber: "TV number validation",
      validateWaterNumber: "water account number validation",
      validateMeterNumber: "meter number validation",
      validatePrn: "PRN validation",
      requestPaymentMethod: "payment method selection",
      validatePaymentMethod: "payment method validation",
      validateEmail: "email validation",
      validatePhoneNumber: "phone number validation",
      finalizePayment: "payment finalization"
    };

    return stepDescriptions[step] || "current step";
  }

  static async changePaymentMethod(message, session, businessPhoneNumberId) {
    // Store current progress and payment details
    const currentProgress = {
      service: session.state.currentService,
      paymentDetails: session.getPaymentDetails(),
      completedSteps: session.state.flowCompletedStates
    };

    session.state.paymentMethod = null;
    session.state.userEmail = null;
    session.state.userPhone = null;

    // Remove payment-related completed steps while keeping service validation steps
    session.state.flowCompletedStates = session.state.flowCompletedStates.filter(step =>
      !this.PAYMENT_METHOD_STATES.includes(step)
    );

    const changeMessage =
      `Changing payment method for your ${session.state.currentService.toUpperCase()} payment.\n\n` +
      `Your previous information has been saved.`;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      changeMessage,
      message.id
    );

    // Return to payment method selection
    await this.requestPaymentMethod(message, session, session.userName, businessPhoneNumberId);
  }

  static async showHelpMessage(message, session, businessPhoneNumberId) {
    const currentStep = session.state.flowNextState;
    const canChangePayment = this.PAYMENT_METHOD_STATES.includes(currentStep);

    const helpMessage = 
      `Available commands:\n\n` +
      `• Type "cancel" to cancel the current transaction\n` +
      `• Type "back" to go to the previous step\n` +
      `• Type "start over" to begin a new transaction\n` +
      `• Type "help" to see this message again\n` +
      (canChangePayment ? `• Type "change payment" to select a different payment method\n` : '') +
      `\nCurrent progress: ${this.getProgressMessage(session)}\n\n` +
      `Need more assistance? Contact our support at GTbank`;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      helpMessage,
      message.id
    );
  }

  static getProgressMessage(session) {
    if (!session.state.currentService) {
      return 'No active transaction';
    }

    const step = session.state.flowNextState;
    const stepDescription = this.getStepDescription(step);
    return `Processing ${session.state.currentService} payment - ${stepDescription}`;
  }

  static async startOver(message, session, businessPhoneNumberId) {
    const confirmMessage =
      `Are you sure you want to start over? All progress will be lost.\n\n` +
      `Reply with:\n` +
      `• "Yes" to confirm\n` +
      `• "No" to continue current transaction`;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      confirmMessage,
      message.id
    );

    session.state.tempState = { ...session.state };
    session.state.flowNextState = "confirmStartOver";
  }


  static async processFlowStep(message, session, businessPhoneNumberId) {
    const text = message.text.body;
    const userName = session.userName;
    const flowNextState = session.state.flowNextState;

    // Add to completed states for back functionality
    if (flowNextState && flowNextState !== "confirmStartOver" && flowNextState !== "handleCancellation") {
      session.state.flowCompletedStates = session.state.flowCompletedStates || [];
      session.state.flowCompletedStates.push(flowNextState);
    }

    switch (flowNextState) {
      case "confirmStartOver":
        if (text === "yes") {
          session.resetState();
          await this.showServices(message, session, businessPhoneNumberId);
        } else if (text === "no") {
          session.state = { ...session.state.tempState };
          delete session.state.tempState;
          await WhatsAppService.sendMessage(
            businessPhoneNumberId,
            message.from,
            "Continuing with your transaction...",
            message.id
          );
        }
        break;

      case "handleCancellation":
        session.resetState();
        await this.showServices(message, session, businessPhoneNumberId);
        break;
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
            `Please send 'confirm' to proceed with payment or 'cancel' to stop.`,
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

      
      // Show different message if changing payment method
      const isChanging = session.state.flowCompletedStates?.includes('requestPaymentMethod');
      
      const paymentMessage = isChanging ?
      `Please select your new payment method:\n\n` :
      `Please choose your preferred payment method:\n\n`;


      const fullMessage = 
      `${paymentMessage}` +
      paymentOptions.map(option =>
        `*${option.type}* ${option.emoji}\n` +
        `└ ${option.description}`
      ).join('\n\n') +
      '\n\nReply with either *Card* or *Mobile* to proceed.\n\n' +
      `Available commands:\n` +
      `• Type "cancel" to cancel transaction\n` +
      `• Type "help" for more options`;

      // Send payment options message
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        fullMessage,
        message.id
      );

      // Update session state
      session.state.flowNextState = "validatePaymentMethod";
      session.state.paymentOptions = paymentOptions.map(option => option.type.toLowerCase());

    } catch (error) {
      // Handle any errors
      console.error('Error in requestPaymentMethod:', error);
      await this.handleError(message, session, businessPhoneNumberId);
    }
  }


  static async handleError(message, session, businessPhoneNumberId) {
    const errorMessage =
      `Sorry, we encountered an error processing your request.\n\n` +
      `You can:\n` +
      `• Type "start over" to begin again\n` +
      `• Type "help" for assistance\n` +
      `• Contact support at +256-200-710-500`;

    await WhatsAppService.sendMessage(
      businessPhoneNumberId,
      message.from,
      errorMessage,
      message.id
    );
  }

  static async validatePaymentMethod(text, message, session, businessPhoneNumberId) {
    try {
      const choice = text.toLowerCase().trim();
      // const validOptions = session.state.paymentOptions || ['card', 'mobile'];
      const validOptions = session.state.paymentOptions

      if (validOptions.includes(choice)) {
        // Check if payment method is being changed
        const isChanging = session.state.flowCompletedStates?.includes('requestPaymentMethod');
        const confirmMessage = isChanging ?
          `You have changed your payment method to ${choice} payment.\n` :
          `You have selected ${choice} payment.\n`;
        // Store the payment method in session
        session.state.paymentMethod = choice;

        
        // Send confirmation message
        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `${confirmMessage}\n` +
          `Amount: UGX ${session.getPaymentDetails()?.amount || 500}\n` +
          `Service: ${session.state.currentService}\n\n` +
          `Proceeding with payment details...`,
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

      await this.handleError(message, session, businessPhoneNumberId);
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
        `Your TV number is ${tvNumber}. Please send 'confirm' to proceed with payment or 'cancel' to stop.`,
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
        `Your Water account number is ${waterNumber}. Please send 'confirm' to proceed with payment or 'cancel' to stop.`,
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
        `Your meter number is ${meterNumber}. Please type 'confirm' to proceed / 'cancel' .`,
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