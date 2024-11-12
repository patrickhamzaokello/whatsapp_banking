import { PrnService } from '../services/prns.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';
export class PhoneNumber_Validator {

    async validatePhonenumber(phoneNumber, message, session, userName, businessPhoneNumberId) {

        // Regex for phone numbers starting with 256 or 0 (Ugandan format)
        // Accepts formats: 256XXXXXXXXX, 0XXXXXXXXX, +256XXXXXXXXX
        const phoneRegex = /^(?:256|\+256|0)?([17]\d{8}|[2-9]\d{8})$/;

        // Remove any spaces, hyphens or other characters
        const cleanPhoneNumber = phoneNumber.replace(/[\s-]/g, '');

        // Standardize the phone number format
        const formatPhoneNumber = (number) => {
            if (number.startsWith('0')) {
                return '256' + number.substring(1);
            }
            if (number.startsWith('+')) {
                return number.substring(1);
            }
            return number;
        };

        const isValidPhone = phoneRegex.test(cleanPhoneNumber);

        if (isValidPhone) {
            try {
                // Format phone number to standard format (256XXXXXXXXX)
                const standardizedPhone = formatPhoneNumber(cleanPhoneNumber);
                session.state.userPhone = standardizedPhone;

                const serviceType = session.state.currentService;
                // Construct success message
                let successMessage =
                    `Thank you ${session.userName}!\n\n` +
                    `I have sent a payment prompt to your phone number: ${standardizedPhone}\n\n` +
                    `Please check your phone and authorize the payment to complete the transaction.\n\n` +
                    `Service: ${serviceType}\n` +
                    `Amount: UGX 500`;

                if (serviceType == 'prn') {
                    // Initiate Universal PRN transction
                    const prnService = new PrnService();

                    const latestPRNDetails = session.getLatestPRN();
                    if (latestPRNDetails) {
                        const result = await prnService.universialPRNCompleteTransaction(latestPRNDetails.number, standardizedPhone);

                        // if invalid prn
                        if (result.status_code === "1013") {
                            // Construct success message
                            successMessage =
                                `Hello ${session.userName}!\n\n` +
                                `This is an ${result.status_description.toLowerCase()}\n\n` +
                                `PRN: ${result.prn_number}\n` +
                                `Phone: ${standardizedPhone}\n\n` +
                                `Thanks, Your Session has ended`;
                        }
                        // if valid prn
                        if (result.status_code === "1000") {

                            const status_desc = result.status_description;
                            const search_text = status_desc.toLowerCase();
                            let userdirection_message = "Thank you!";

                            if (search_text.includes('pending authorisation')) {
                                userdirection_message = "👉Please check your phone and authorize the payment to complete the transaction.";
                            }
                            // Construct success message
                            successMessage =
                                `Hello ${session.userName}!\n\n` +
                                `${userdirection_message}\n\n`+
                                `PRN: ${result.prn_number}\n` +
                                `Reference: ${result.reference}\n` +
                                `Phone: ${standardizedPhone}\n` +
                                `Service: ${serviceType}\n` +
                                `Amount: ${latestPRNDetails.amount} UGX \n\n` +
                                `${result.status_description}`;


                        }
                    } else {
                        successMessage =
                            `Hello ${session.userName}!\n\n` +
                            `Internal error, Please initiate again`;
                    }

                }

                // Send confirmation message
                await WhatsAppService.sendMessage(
                    businessPhoneNumberId,
                    message.from,
                    successMessage,
                    message.id
                );

                // Update session state
                session.state.flowNextState = null;
                session.state.overallProgress = 100;
                session.attempts.phoneNumber = 0;

            } catch (error) {
                // Handle payment service errors
                await WhatsAppService.sendMessage(
                    businessPhoneNumberId,
                    message.from,
                    "Sorry, we encountered an error processing your payment request. Please try again."
                );
                console.error('Payment processing error:', error);
            }
        } else {
            // Handle invalid phone number attempts
            session.attempts.phoneNumber = (session.attempts.phoneNumber || 0) + 1;

            if (session.attempts.phoneNumber < 3) {
                const remainingAttempts = 3 - session.attempts.phoneNumber;
                const attemptsMessage =
                    `Invalid phone number format.\n\n` +
                    `Please enter a valid phone number:\n` +
                    `• Starting with 256... (e.g., 2567xxxxxxxx)\n` +
                    `• Starting with 0... (e.g., 07xxxxxxxx)\n` +
                    `• Or starting with +256... (e.g., +2567xxxxxxxx)\n\n` +
                    `You have ${remainingAttempts} ${remainingAttempts === 1 ? 'attempt' : 'attempts'} remaining.`;

                await WhatsAppService.sendMessage(
                    businessPhoneNumberId,
                    message.from,
                    attemptsMessage,
                    message.id
                );
            } else {
                // Reset session after maximum attempts
                const sessionEndedMessage =
                    `You have exceeded the maximum number of attempts.\n` +
                    `Your session has ended. Please start over to try again.`;

                await WhatsAppService.sendMessage(
                    businessPhoneNumberId,
                    message.from,
                    sessionEndedMessage
                );

                session.attempts.phoneNumber = 0;
                session.resetState();
                // await this.showServices(message, session, businessPhoneNumberId);
            }
        }

    }

}