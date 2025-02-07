import { PaymentService } from '../services/payment.service.js';
import { config } from '../config/environment.js';

export default class GTPayHandler {
    static async initiateThroughGTPayment(transactionId, email, serviceType, amount, userName, prn) {
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
                    email,
                    prn,
                    transactionId
                );

                if (prn && serviceType === 'pay_prn') {

                    const paymentLink = await PaymentService.generatePRNPaymentLink(paymentDetails);
                    response = {
                        paymentLink,
                        status: true,
                    };

                    return response;
                }

                const paymentLink = await PaymentService.generateUtitilyPaymentLink(paymentDetails);
                response = {
                    paymentLink,
                    status: true,
                };

                return response;

            } catch (error) {
                console.error("Error generating payment link:", error);
                response.paymentLink = null;
                response.status = false;
            }
        } else {
            console.warn("Invalid email address provided:", email);
        }

    }


    static getCurrentDate() {
        return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
    }


    static formatName(name) {
        return name.replace(/_/g, ' ').replace(/\s+/g, ' ');
    }

    static formatTransDetails(service) {
        return `Payment for ${service.replace(/_/g, ' ')}`.replace(/\s+/g, ' ');
    }

    static formatPRN(prn) {
        return prn.replace(/\D/g, '');
    }
}
