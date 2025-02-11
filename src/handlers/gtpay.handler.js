import { PaymentService } from "../services/payment.service.js";
import { config } from "../config/environment.js";

export default class GTPayHandler {
    static async initiateThroughGTPayment(
        transactionId,
        email,
        serviceType,
        amount,
        userName,
        prn
      ) {
        // RFC 5322 compliant email regex
        const emailRegex =
          /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
      
        const response = {
          paymentLink: null,
          status: false,
          error: null
        };
      
        // Input validation
        if (!email || !serviceType || !amount || !userName || !transactionId) {
          response.error = 'Missing required parameters';
          return response;
        }
      
        // Email validation
        if (!emailRegex.test(email)) {
          response.error = 'Invalid email address';
          console.warn("Invalid email address provided:", email);
          return response;
        }
      
        try {
          // Generate payment details
          const paymentDetails = await PaymentService.generatePaymentDetails(
            serviceType,
            amount,
            userName,
            email,
            prn,
            transactionId
          );
      
          // Generate appropriate payment link based on service type
          let paymentLink;
          if (prn && serviceType === "pay_prn") {
            paymentLink = await PaymentService.generatePRNPaymentLink(paymentDetails);
          } else {
            paymentLink = await PaymentService.generateUtitilyPaymentLink(paymentDetails);
          }
      
          return {
            paymentLink,
            status: true,
            error: null
          };
      
        } catch (error) {
          console.error("Error generating payment link:", error);
          response.error = error.message || 'Failed to generate payment link';
          return response;
        }
      }
}
