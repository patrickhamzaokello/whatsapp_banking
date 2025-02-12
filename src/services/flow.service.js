import logger from '../config/logger.js';
import axios from 'axios';
import { config } from '../config/environment.js';
import { WhatsAppError } from '../errors/custom-errors.js';
import { v4 as uuidv4 } from 'uuid';
import { WhatsAppService } from './whatsapp.service.js';
import { PrnService } from './prns.service.js';
import { UmemeService } from './umeme.service.js';
import { NwscService } from './nwsc.service.js';
import GTPayHandler from "../handlers/gtpay.handler.js";
import database from '../config/database.js';

export class FlowService {

    static async flow_reply_processor(businessPhoneNumberId, message, contact, message_id) {

        const flowResponse = message.interactive.nfm_reply.response_json;
        const from_contact = message.from;
        const flowData = JSON.parse(flowResponse);

        const { flow_token } = flowData;

        // db return flow details and 
        const { FlowToken, UserID, FlowName } = await database.getFlowTokenDetailsbyToken(flow_token);

        if (!FlowToken) {
            await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, 'The form you submitted is invalid. Initiate a new form', message_id)
        }

        switch (FlowName) {
            case 'Bills Payment':
                await this.processBillPaymentReceivedFlowMessage(businessPhoneNumberId, message, contact, message_id);
                break;
            case 'Account Openning':
                await this.processAccountOpeningFlowMessage(businessPhoneNumberId, message, contact, message_id);
                break;
            case 'Customer Support':
                await this.processCustomerSupportFlowMessage(businessPhoneNumberId, message, contact, message_id);
                break;
            case 'Merchant Payment':
                await this.processMerchantsPaymentFlowMessage(businessPhoneNumberId, message, contact, message_id);
                break;
            default:
                await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, 'The form you submitted is invalid. Initiate a new form', message_id)
        }

    }

    static async processMerchantsPaymentFlowMessage(businessPhoneNumberId, message, contact, message_id) {
        const flowResponse = message.interactive.nfm_reply.response_json;
        const from_contact = message.from;
        const flowData = JSON.parse(flowResponse);
        const message_body = `Hey ${contact.profile.name}, \n\nPlease authorize debit request sent to your mobile money number to complete payment to merchant. \n\nYou will receive a receipt here after payment is confirmed`            
        await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, message_body, message_id)

    }

    static async processCustomerSupportFlowMessage(businessPhoneNumberId, message, contact, message_id) {
        const flowResponse = message.interactive.nfm_reply.response_json;
        const from_contact = message.from;
        const flowData = JSON.parse(flowResponse);
        const message_body = `Hey ${contact.profile.name}, \n\nWe have received your message, our customer support team will get back to you shortly.`

        //save customer support issue form to db
        const userId = await database.getOrCreateUser(from_contact);
        const { supportID, FlowToken, MessageID } = await database.saveCustomerSupportFlowData(flowData, userId, message_id, from_contact);

        if (supportID) {
            let handover_to_human = true;
            await database.updateUserChatState(userId, handover_to_human);
            await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, message_body, message_id)
        } else {
            await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, 'We are unable to forward your request, please try again', message_id)
        }

    }

    static async processAccountOpeningFlowMessage(businessPhoneNumberId, message, contact, message_id) {
        console.log(message)
        const flowResponse = message.interactive.nfm_reply.response_json;
        const from_contact = message.from;
        const flowData = JSON.parse(flowResponse);
        const message_body = `Hey ${contact.profile.name}, \n\nTo complete your account setup, simply tap 'Send Location' below to share your residential address.\n\nYour information is safe with us.`

        //save account form to db
        const userId = await database.getOrCreateUser(from_contact);
        const { AccountID, FlowToken, MessageID } = await database.saveAccountOpeningFlowData(flowData, userId, message_id, from_contact);

        if (AccountID) {
            // sendLocationRequestMessage
            await WhatsAppService.sendLocationRequestMessage(from_contact, message_body);
        } else {
            await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, 'Error occur while saving your data! Try again', message_id)
        }

    }

    static async processBillPaymentReceivedFlowMessage(businessPhoneNumberId, message, contact, message_id) {
        const flowResponse = message.interactive.nfm_reply.response_json;
        const from_contact = message.from;

        const flowData = JSON.parse(flowResponse);
        const {
            is_prn,
            is_nwsc,
            is_tv,
            is_yaka,
            is_mobile,
            s_amount,
            is_account,
            s_prn_number,
            s_nwsc_meter_no,
            s_nwsc_area_selected,
            s_umeme_meter_type,
            s_umeme_meter_no,
            s_tv_provider_selected,
            s_tv_card_no,
            s_selected_bank_service,
            s_service_message,
            selected_payment_method,
            phone_number,
            email_address,
            tax_payer_name,
            flow_token
        } = flowData


        // Get the user phone number
        let reply_userName = contact.profile.name;
        let userdirection_message = "Error: Unable to initiate Payment.";
        let summary_reply = "Please Try again";

        const userId = await database.getOrCreateUser(from_contact);
        const { TXN_ID } = await database.processBillPayment(flowData, userId, message_id, from_contact);


        //initiate payment for service
        if (is_prn) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {
                const prn_service = new PrnService();
                const result = await prn_service.universialPRNCompleteTransaction(TXN_ID, s_prn_number, phone_number);
                // if invalid prn
                if (result.status_code === "1013") {
                    userdirection_message = `🛑 Payment initiation failed. Reason: ${result.status_description.toLowerCase()}`;
                }
                // if valid prn
                if (result.status_code === "1000") {
                    const status_desc = result.status_description;
                    const search_text = status_desc.toLowerCase();
                    userdirection_message = `⚠ Payment initiation failed. Reason: PRN Already Paid`;

                    if (search_text.includes('pending authorisation')) {
                        userdirection_message = `👉 We have sent a prompt to this number *${phone_number}*.  Authorize the payment to complete the payment`;
                    }

                }
                summary_reply = `*PRN Number:* ${s_prn_number} \n*Tax Payer Name:* ${tax_payer_name} \n*Amount(UGX):* ${s_amount}`.trim();
            }
            if (is_account) {
                const { paymentLink, status, error } = await GTPayHandler.initiateThroughGTPayment(
                    TXN_ID,
                    email_address,
                    s_selected_bank_service,
                    s_amount,
                    reply_userName,
                    s_prn_number
                  );
                console.log("account payment", paymentLink, status, error)

                  
                  if (status && paymentLink) {
                    userdirection_message = `👉 Please complete your payment using the following link: ${paymentLink}`;
                  } else {
                    // Provide more specific error messages based on the error field
                    userdirection_message = error
                      ? `We encountered an issue: ${error}. Please try again or contact support if the issue persists.`
                      : `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`;
                  }
                  
                  // Add payment attempt information to the summary
                  summary_reply = `
                  *PRN Number:* ${s_prn_number} \n*Amount(UGX):* ${s_amount} \n*Tax Payer Name:* ${tax_payer_name} \n*Status:* ${status ? '✅ Payment link generated' : '❌ Payment initiation failed'}
                  `.trim();

            }

        }
        if (is_nwsc) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {

                const nwsc_service = new NwscService();
                await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, "Please wait, as I initiate your payment...🟡", message_id)

                const result = await nwsc_service.InitiateNwscTransaction(s_nwsc_meter_no, s_nwsc_area_selected, TXN_ID, s_amount, phone_number);

                console.log(result);
                // if invalid yaka
                if (result.status_code !== "1000") {
                    userdirection_message = `NWSC Payment initiation failed. ⛔`;
                }
                // if valid yaka
                if (result.status_code === "1000") {
                    const status_desc = result.status;
                    userdirection_message = `NWSC payment has been completed Successfully ✅`;
                }
                // post nwsc water
                summary_reply = `*NWSC Meter no:* ${s_nwsc_meter_no}\n*Area:* ${s_nwsc_area_selected} \n*Amount(UGX):* ${s_amount}`.trim();
            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(TXN_ID, email_address, s_selected_bank_service, s_amount, reply_userName, s_nwsc_meter_no);
                if (status) {
                    userdirection_message = `👉 Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*NWSC Meter no:* ${s_nwsc_meter_no}\n*Area:* ${s_nwsc_area_selected} \n*Amount(UGX):* ${s_amount}`.trim();

            }

        }
        if (is_yaka) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {

                const umemeService = new UmemeService();
                await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, "Please wait, as I initiate your payment...🟡", message_id)
                const result = await umemeService.InitiateUmemeTransaction(s_umeme_meter_no, s_umeme_meter_type.toLowerCase(), TXN_ID, s_amount, phone_number);
                console.log(result);
                // if invalid yaka
                if (result.status_code !== "1000") {
                    userdirection_message = `Umeme Payment initiation failed. ⛔`;
                }
                // if valid yaka
                if (result.status_code === "1000") {
                    const status_desc = result.status;
                    userdirection_message = `Umeme payment has been completed Successfully ✅`;
                }
                summary_reply = `*UMEME Meter no:* ${s_umeme_meter_no}\n*Meter type:* ${s_umeme_meter_type} \n*Amount(UGX):* ${s_amount}`.trim();


            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(TXN_ID, email_address, s_selected_bank_service, s_amount, reply_userName, s_umeme_meter_no);
                if (status) {
                    userdirection_message = `👉 Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*UMEME Meter no:* ${s_umeme_meter_no}\n*Meter type:* ${s_umeme_meter_type} \n*Amount(UGX):* ${s_amount}`.trim();

            }

        }

        if (is_tv) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {

                userdirection_message = `We have sent a prompt to this number *${phone_number}*.  Authorize the payment to complete the payment`;
                // post nwsc water
                summary_reply = `*TV no:* ${s_tv_card_no}\n*Provider:* ${s_tv_provider_selected} \n*Amount(UGX):* ${s_amount}`.trim();
            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(TXN_ID, email_address, s_selected_bank_service, s_amount, reply_userName, s_tv_card_no);
                if (status) {
                    userdirection_message = `👉 Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*TV no:* ${s_tv_card_no}\n*Provider:* ${s_tv_provider_selected} \n*Amount(UGX):* ${s_amount}`.trim();
            }

        }

        userdirection_message = `Hello ${reply_userName},  \n${userdirection_message} \n\n${summary_reply}`;
        await WhatsAppService.sendMessage(businessPhoneNumberId, from_contact, userdirection_message, message_id)
    }


    static async sendCustomerSupportFlow(flowId, recipientPhoneNumber, phoneNumberId) {
        const flowToken = uuidv4();
        const userId = await database.getOrCreateUser(recipientPhoneNumber);
        const db_result = await database.insertFlowForm(userId, flowToken, "Customer Support");
        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'Customer Support' },
            body: {
                text: 'Use the form below👇 to submit your support request. Our support team will get back to you as soon as possible.'
            },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_id: flowId,
                    flow_token: flowToken,
                    flow_cta: 'Support form',
                    flow_action: 'navigate',
                    flow_action_payload: {
                        screen: "CUSTOMER_QUERIES", 
                    }
                }
            }
        }
        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhoneNumber,
            type: 'interactive',
            interactive: flowPayload
        };

        try {
            const response = await axios({
                method: "POST",
                url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
                headers: {
                    Authorization: `Bearer ${config.webhook.graphApiToken}`
                },
                data: payload
            });



            return response.data;
        }
        catch (error) {
            logger.error('Error sending WhatsApp Flow message', { recipientPhoneNumber, flowId, error });
            throw new WhatsAppError('Failed to send message flow');
        }
    }

    static async sendMerchantPaymentFlow(flowId, recipientPhoneNumber, phoneNumberId) {
        const flowToken = uuidv4();

        const userId = await database.getOrCreateUser(recipientPhoneNumber);
        const db_result = await database.insertFlowForm(userId, flowToken, "Merchant Payment");

        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'Merchant Payments' },
            body: {
                text: 'Click the button below 👇 to Initiate payments to a merchant.🎁'
            },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    // mode: 'draft', //remember to remove when flow is 100% published.
                    flow_cta: 'Pay merchant',
                    flow_action: 'navigate',
                    flow_action_payload: {
                        screen: "WELCOME", //remember to update the screen name if change
                    }
                }
            }
        };

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhoneNumber,
            type: 'interactive',
            interactive: flowPayload
        };

        try {
            const response = await axios({
                method: "POST",
                url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
                headers: {
                    Authorization: `Bearer ${config.webhook.graphApiToken}`
                },
                data: payload
            });



            return response.data;
        }
        catch (error) {
            logger.error('Error sending WhatsApp Flow message', { recipientPhoneNumber, flowId, error });
            throw new WhatsAppError('Failed to send message flow');
        }
    }

    static async sendAccountOpenningFlow(flowId, recipientPhoneNumber, phoneNumberId) {
        const flowToken = uuidv4();

        const userId = await database.getOrCreateUser(recipientPhoneNumber);
        const db_result = await database.insertFlowForm(userId, flowToken, "Account Openning");
        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'Open a GTbank Account' },
            body: {
                text: 'Please fill in the form below 👇 to open your account.'
            },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    // mode: 'draft', //remember to remove when flow is 100% published.
                    flow_cta: 'Account Openning Form',
                    flow_action: 'navigate',
                    flow_action_payload: {
                        screen: "ACCOUNT", //remember to update the screen name if changed
                        data: {
                            selected_account_type: "digital",
                            selected_account_currency: "ugx",
                            account_currency: [
                                {
                                    id: "UGX",
                                    title: "UGX"
                                },
                                {
                                    id: "USD",
                                    title: "USD"
                                },
                                {
                                    id: "EURO",
                                    title: "EURO"
                                },
                                {
                                    id: "GBP",
                                    title: "GBP"
                                }
                            ],
                            account_type: [
                                {
                                    id: "Digital Account",
                                    title: "Digital Account"
                                },
                                {
                                    id: "GT Savings Account",
                                    title: "GT Savings Account"
                                }
                            ]
                        }
                    }
                }
            }
        };

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhoneNumber,
            type: 'interactive',
            interactive: flowPayload
        };

        try {
            const response = await axios({
                method: "POST",
                url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
                headers: {
                    Authorization: `Bearer ${config.webhook.graphApiToken}`
                },
                data: payload
            });



            return response.data;
        }
        catch (error) {
            logger.error('Error sending WhatsApp Flow message', { recipientPhoneNumber, flowId, error });
            throw new WhatsAppError('Failed to send message flow');
        }
    }

    static async sendURATAXPaymentFlow(flowId, recipientPhoneNumber, phoneNumberId) {
        const flowToken = uuidv4();

        const userId = await database.getOrCreateUser(recipientPhoneNumber);
        const db_result = await database.insertFlowForm(userId, flowToken, "Bills Payment");

        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'To Pay URA Tax' },
            body: {
                text: 'Use the form below 👇 to initiate payments for URA TAX'
            },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    flow_cta: 'PRN Payment form',
                    flow_action: 'navigate',
                    flow_action_payload: {
                        screen: "SELECT_SERVICE",                        
                    }
                }
            }
        };

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhoneNumber,
            type: 'interactive',
            interactive: flowPayload
        };

        try {
            const response = await axios({
                method: "POST",
                url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
                headers: {
                    Authorization: `Bearer ${config.webhook.graphApiToken}`
                },
                data: payload
            });



            return response.data;
        }
        catch (error) {
            logger.error('Error sending WhatsApp Flow message', { recipientPhoneNumber, flowId, error });
            throw new WhatsAppError('Failed to send message flow');
        }
    }

    static async sendBillsPaymentFlow(flowId, recipientPhoneNumber, phoneNumberId) {

        const flowToken = uuidv4();

        const userId = await database.getOrCreateUser(recipientPhoneNumber);
        const db_result = await database.insertFlowForm(userId, flowToken, "Bills Payment");

        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'To Pay Utilities?' },
            body: {
                text: 'Use the form below 👇 to initiate payment. With this form you can pay for  UMEME, NWSC and TV subscriptions.'
            },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    // mode: 'draft', //remember to remove when flow is 100% published.
                    flow_cta: 'Utilities payment form',
                    flow_action: 'navigate',
                    flow_action_payload: {
                        screen: "SELECT_SERVICE",
                        data: {
                            is_prn: false,
                            is_nwsc: false,
                            is_yaka: false,
                            is_tv: false,
                            bank_service_type: [
                                {
                                    id: "pay_service",
                                    title: "Select Service"
                                },
                        
                                {
                                    id: "pay_nwsc",
                                    title: "Pay Nwsc (Water)"
                                },
                                {
                                    id: "pay_yaka",
                                    title: "Pay Yaka / Umeme"
                                },
                                // {
                                //     id: "pay_tv",
                                //     title: "Pay Tv subscription"
                                // }
                            ],
                            nwsc_area: [
                                {
                                    id: "0",
                                    title: "Select area"
                                },
                                {
                                    id: "1",
                                    title: "Kampala"
                                },
                                {
                                    id: "2",
                                    title: "Jinja"
                                },
                                {
                                    id: "3",
                                    title: "Entebbe"
                                },
                                {
                                    id: "4",
                                    title: "Mukono"
                                }
                                , {
                                    id: "5",
                                    title: "Kajjansi"
                                },
                                {
                                    id: "6",
                                    title: "Kawuku"
                                },
                                {
                                    id: "7",
                                    title: "Iganga"
                                },
                                {
                                    id: "8",
                                    title: "Lugazi"
                                },
                                {
                                    id: "9",
                                    title: "Others"
                                }
                            ],
                            umeme_meter_type: [
                                {
                                    id: "select_umeme_meter",
                                    title: "Select meter type"
                                },
                                {
                                    id: "PREPAID",
                                    title: "Yaka"
                                },
                                {
                                    id: "POSTPAID",
                                    title: "Postpaid"
                                },
                                {
                                    id: "QUOTATION",
                                    title: "New Connection / others"
                                }
                            ],
                            tv_providers: [
                                {
                                    id: "0",
                                    title: "Select Tv provider"
                                },
                                {
                                    id: "1",
                                    title: "DSTV"
                                },
                                {
                                    id: "2",
                                    title: "GOTV"
                                },
                                {
                                    id: "3",
                                    title: "STAR TIMES"
                                },
                                {
                                    id: "4",
                                    title: "AZAM"
                                }
                                , {
                                    id: "5",
                                    title: "ZUKU"
                                }
                            ],
                            selected_bank_service: "pay_service",
                            selected_nwsc_area: "0",
                            selected_tv_provider: "0",
                            selected_umeme_meter_type: "select_umeme_meter"
                        },
                    }
                }
            }
        };

        const payload = {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: recipientPhoneNumber,
            type: 'interactive',
            interactive: flowPayload
        };

        try {
            const response = await axios({
                method: "POST",
                url: `${config.whatsapp.baseUrl}/${config.whatsapp.apiVersion}/${phoneNumberId}/messages`,
                headers: {
                    Authorization: `Bearer ${config.webhook.graphApiToken}`
                },
                data: payload
            });



            return response.data;
        }
        catch (error) {
            logger.error('Error sending WhatsApp Flow message', { recipientPhoneNumber, flowId, error });
            throw new WhatsAppError('Failed to send message flow');
        }
    }


}