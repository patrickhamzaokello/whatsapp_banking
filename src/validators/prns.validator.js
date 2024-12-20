// this class with be to validate prns
import { PrnService } from '../services/prns.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
export class PRN_Validator {

  async checkPRNStatus(prn) {
    const prnService = new PrnService();
    const result = await prnService.validatePRN(prn);
    let prn_message = "Something went wrong. Try again.";
    let status = "error"; // Default status
   let prn_amount = "na";

    if (result.status_code === "N") {
        prn_message = `🛑 Invalid PRN ${prn}. Try again.`;
        status = "invalid";
    }

    // PRN available to pay
    if (result.status_code === "A") {
        prn_message = `Please confirm the PRN Details Below:\n\n` +
            `PRN Number: ${result.prn_number}\n` +
            `Status: ${result.status}\n` +
            `Amount: ${result.details.amount} ${result.details.currency}\n` +
            `Taxpayer Name: ${result.details.taxpayerName}\n` +
            `Expiry Date: ${result.details.expiryDate}\n` +
            `Description: ${result.details.description}\n\n`;
        status = "available";
        prn_amount = result.details.amount;
    }

    // PRN already paid. Enter new PRN
    if (result.status_code === "T") {
        prn_message = `The PRN is already Paid 😢:\n\n` +
            `PRN Number: ${result.prn_number}\n` +
            `Status: ${result.status}\n` +
            `Amount: ${result.details.amount} ${result.details.currency}\n` +
            `Taxpayer Name: ${result.details.taxpayerName}\n` +
            `Description: ${result.details.description}\n\n`;
        status = "paid";
        prn_amount = result.details.amount;
    }

    return { prn_message, status, prn_amount };
  }

  async validatePrn(prn, message, session, userName, businessPhoneNumberId) {
    const prnService = new PrnService();
    const result = await prnService.validatePRN(prn);
    // not valid prn
    if (result.status_code === "N") {
      session.attempts.prn++;
      if (session.attempts.prn < 3) {

        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `🛑 Invalid PRN ${prn}. You have ${3 - session.attempts.prn
          } attempts left. Please try again.`,
          message.id
        );
      } else {

        await WhatsAppService.sendMessage(
          businessPhoneNumberId,
          message.from,
          `You have exceeded the maximum number of attempts allowed ⚠. your session has ended.`
        );
        session.attempts.prn = 0; // Reset attempts after exceeding the limit
        session.resetState()
      }
    }

    // prn available to pay
    if (result.status_code === "A") {
      const prnAvailableMessage = `Please confirm the PRN Details Below:\n\n` +
        `PRN Number: ${result.prn_number}\n` +
        `Status: ${result.status}\n` +
        `Amount: ${result.details.amount} ${result.details.currency}\n` +
        `Taxpayer Name: ${result.details.taxpayerName}\n` +
        `Expiry Date: ${result.details.expiryDate}\n` +
        `Description: ${result.details.description}\n\n` +
        `👉 Please send 'confirm' to proceed with payment or 'cancel' to stop.\n\n`;


      // available to pay
      session.addPRN({
        number: prn,
        amount: result.details.amount,
        description: result.details.description
      });

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        prnAvailableMessage,
        message.id
      );
      session.state.flowNextState = "requestPaymentMethod";
      session.attempts.prn = 0; // Reset attempts after successful validation
    }

    // prn already paid. enter new prn
    if (result.status_code === "T") {
      const prnPaidMessage = `The PRN is already Paid 😢:\n\n` +
        `PRN Number: ${result.prn_number}\n` +
        `Status: ${result.status}\n` +
        `Amount: ${result.details.amount} ${result.details.currency}\n` +
        `Taxpayer Name: ${result.details.taxpayerName}\n` +
        `Description: ${result.details.description}\n\n` +
        `👉Reply with 'pay prn' to pay for a new prn payment\n\n`;

      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        prnPaidMessage,
        message.id
      );
      session.attempts.prn = 0;
      session.resetState()
    }

    else {
      await WhatsAppService.sendMessage(
        businessPhoneNumberId,
        message.from,
        `Unable to validate PRN, Try again`
      );
      session.attempts.prn = 0; // Reset attempts after exceeding the limit
      session.resetState()
    }
  }
}
