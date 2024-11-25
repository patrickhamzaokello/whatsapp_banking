import logger from '../config/logger.js';
import axios from 'axios';
import { config } from '../config/environment.js';
import { WhatsAppError } from '../errors/custom-errors.js';
import { v4 as uuidv4 } from 'uuid';
import { WhatsAppService } from './whatsapp.service.js';

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
            is_account,
            s_selected_bank_service,
            s_service_message,
            selected_payment_method,
            phone_number,
            flow_token
        } = flowData

        const reply = `Summary:\n\n*Service:* ${s_service_message} \n*Payment Method:* ${selected_payment_method} \n*Phone Number:* ${phone_number}`.trim();

        // Get the user phone number
        const userPhoneNumber = req.body.entry[0].changes[0].value.contacts[0].wa_id;

        // Send the reply
        await WhatsAppService.sendMessage(businessPhoneNumberId, userPhoneNumber, reply, message_id)

    }

    static async sendFlow(flowId, recipientPhoneNumber, phoneNumberId) {

        const flowToken = uuidv4();

        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: 'Hello' },
            body: {
                text: 'Welcome to Gtbank Uganda – Use this form to make payments for PRN, NWSC, TV, UMEME/YAKA'
            },
            footer: { text: 'Click the button below to proceed' },
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    mode: 'draft', //remember to remove when flow is 100% ready.
                    flow_cta: 'Select Service to Pay',
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


    static async sendInteractiveMessage(userName,body_message, recipientPhoneNumber, phoneNumberId) {

        const flowPayload = {
            type: "button",
            header: {
                type: "text",
                text: `Hello ${userName}`
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
                            "title": "Pay Utilities"
                        }
                    },
                    {
                        "type": "reply",
                        "reply": {
                            "id": "otherOption",
                            "title": "Other Options"
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