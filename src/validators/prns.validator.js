// this class with be to validate prns
import { PrnService } from '../services/prns.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
export class PRN_Validator {  
    
  async validatePrn(prn, message, session, userName, businessPhoneNumberId) {
    const prnService = new PrnService();
    const result = await prnService.validatePRN(prn);
    // not valid prn
    if(result.status_code === "N"){
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
    if(result.status_code === "A"){
        const prnAvailableMessage =  `Please confirm the PRN Details Below:\n\n` +
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
    if(result.status_code === "T"){
        const prnPaidMessage =  `The PRN is already Paid 😢:\n\n` +
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
  }
}
