import logger from '../config/logger.js';
import axios from 'axios';
import { config } from '../config/environment.js';
import { WhatsAppError } from '../errors/custom-errors.js';
import { v4 as uuidv4 } from 'uuid';
import { WhatsAppService } from './whatsapp.service.js';
import { PrnService } from '../services/prns.service.js';
import GTPayHandler from "../handlers/gtpay.handler.js";

export class FlowService {

    static async flow_reply_processor(businessPhoneNumberId, req, message_id) {
        const flowResponse = req.body.entry[0].changes[0].value.messages[0].interactive.nfm_reply.response_json;
        const flowData = JSON.parse(flowResponse);
        const {
            is_prn,
            is_nwsc,
            is_tv,
            is_yaka,
            s_selected_service_id,
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
            flow_token
        } = flowData

        // Get the user phone number
        let reply_userPhoneNumber = req.body.entry[0].changes[0].value.contacts[0].wa_id;
        let reply_userName = req.body.entry[0].changes[0].value.contacts[0].profile.name;
        let userdirection_message = "Error: Unable to initiate Payment.";
        let summary_reply = "Unavailable summary";

        //initiate payment for service
        if (is_prn) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {
                const prn_service = new PrnService();
                const result = await prn_service.universialPRNCompleteTransaction(s_prn_number, phone_number);
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
                summary_reply = `*Summary:*\n\nURA Tax Payment *PRN:* ${s_prn_number} \n*Payment Method:* Mobile \n*Phone:* ${phone_number} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();
            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(email_address, s_selected_bank_service, s_amount, reply_userName);
                if (status) {
                    userdirection_message = `Your payment has been initiated successfully. Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*Summary:*\n\nURA Tax Payment *PRN:* ${s_prn_number} \n*Payment Method:* GTBank GTPay \n*Email:* ${email_address} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();

            }

        }
        if (is_nwsc) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {

                userdirection_message = `🛑Unable to initiate payment on this number *${phone_number}*.  please try again`;
                // post nwsc water
                summary_reply = `*Summary:*\n\nNWSC Bill Payment *Meter no:* ${s_nwsc_meter_no} \n*Area:* ${s_nwsc_area_selected} \n*Payment Method:* Mobile \n*Phone:* ${phone_number} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();
            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(email_address, s_selected_bank_service, s_amount, reply_userName);
                if (status) {
                    userdirection_message = `Your payment has been initiated successfully. Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*Summary:*\n\nNWSC Bill Payment *Meter no:* ${s_nwsc_meter_no}  \n*Area:* ${s_nwsc_area_selected} \n*Payment Method:* GTBank GTPay \n*Email:* ${email_address} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();

            }

        }
        if (is_yaka) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {

                userdirection_message = `🛑Unable to initiate payment on this number *${phone_number}*.  please try again`;
                // post nwsc water
                summary_reply = `*Summary:*\n\nUMEME Bill Payment *Meter no:* ${s_umeme_meter_no} \n*Meter type:* ${s_umeme_meter_type} \n*Payment Method:* Mobile \n*Phone:* ${phone_number} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();
            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(email_address, s_selected_bank_service, s_amount, reply_userName);
                if (status) {
                    userdirection_message = `Your payment has been initiated successfully. Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*Summary:*\n\nUMEME Bill Payment *Meter no:* ${s_umeme_meter_no} \n*Meter type:* ${s_umeme_meter_type} \n*Payment Method:* GTBank GTPay \n*Email:* ${email_address} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();

            }

        }

        if (is_tv) {

            //post the prn transaction for either mobile or account
            if (is_mobile) {

                userdirection_message = `🛑Unable to initiate payment on this number *${phone_number}*.  please try again`;
                // post nwsc water
                summary_reply = `*Summary:*\n\nTV Subscription payment *TV no:* ${s_tv_card_no} \n*Meter type:* ${s_tv_provider_selected} \n*Payment Method:* Mobile \n*Phone:* ${phone_number} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();
            }
            if (is_account) {
                const { paymentLink, status } = await GTPayHandler.initiateThroughGTPayment(email_address, s_selected_bank_service, s_amount, reply_userName);
                if (status) {
                    userdirection_message = `Your payment has been initiated successfully. Please complete your payment using the following link: ${paymentLink}`
                } else {
                    userdirection_message = `We encountered an issue while initiating your payment. Please try again later or contact support if the issue persists.`
                }

                summary_reply = `*Summary:*\n\nTV Subscription payment *TV no:* ${s_tv_card_no} \n*Meter type:* ${s_tv_provider_selected} \n*Payment Method:* GTBank GTPay \n*Email:* ${email_address} \n*Amount(UGX):* ${s_amount} \n\n*Form ID:* ${flow_token}`.trim();

            }

        }

        userdirection_message = `Hello ${reply_userName},  \n${userdirection_message} \n\n${summary_reply}`;
        await WhatsAppService.sendMessage(businessPhoneNumberId, reply_userPhoneNumber, userdirection_message, message_id)

    }

    static async sendFlow(flowId, recipientPhoneNumber, phoneNumberId) {

        const flowToken = uuidv4();

        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'Bill Payments' },
            body: {
                text: 'Use this form to make payments for URA Taxes, NWSC, TV, UMEME/YAKA Bills'
            },
            footer: { text: 'Click the button below to proceed' },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    // mode: 'draft', //remember to remove when flow is 100% published.
                    flow_cta: 'Proceed',
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
                                    id: "pay_prn",
                                    title: "Pay PRN (URA)"
                                },
                                {
                                    id: "pay_nwsc",
                                    title: "Pay Nwsc (Water)"
                                },
                                {
                                    id: "pay_yaka",
                                    title: "Pay Yaka / Umeme"
                                },
                                {
                                    id: "pay_tv",
                                    title: "Pay Tv subscription"
                                }
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


    static async sendInteractiveMessage(body_message, recipientPhoneNumber, phoneNumberId) {

        const flowPayload = {
            type: "button",
            header: {
                type: "image",
                image: {
                    id: "600158732435400"
                }
            },
            body: {
                text: body_message
            },
            footer: {
                text: "© 2024 Guaranty Trust Bank, Uganda."
            },
            action: {
                buttons: [
                    {
                        "type": "reply",
                        "reply": {
                            "id": "payService",
                            "title": "Pay Bills"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "otherOption",
                            "title": "More"
                        }
                    }
                ]
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


}