import { PaymentService } from '../services/payment.service.js';

export default class GTPayHandler {
    static async initiateThroughGTPayment(email, serviceType, amount, userName) {
        // RFC 5322 compliant email regex
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        const isValidEmail = emailRegex.test(email);
        let response = {
            paymentLink: null,
            status: false,
        };

        if (isValidEmail) {
            try {
                // Generate payment details
                const paymentDetails = await PaymentService.generatePaymentDetails(
                    serviceType,
                    amount,
                    userName,
                    email
                );

                const paymentLink = await PaymentService.generatePaymentLink(paymentDetails);

                response = {
                    paymentLink,
                    status: true,
                };
            } catch (error) {
                console.error("Error generating payment link:", error);
                response.paymentLink = null;
                response.status = false;
            }
        } else {
            console.warn("Invalid email address provided:", email);
        }

        return response;
    }
}
