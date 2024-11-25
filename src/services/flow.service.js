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

    static async sendFlow(flowId, contact, phoneNumberId) {
        const flowToken = uuidv4();

        const recipientPhoneNumber = contact.wa_id;
        const userName = contact.profile.name;

        const flowPayload = {
            type: 'flow',
            header: { type: 'text', text: `Hello ${userName}` },
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
                    flow_cta: 'Proceed',
                    flow_action: 'data_exchange',
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
            logger.error('Error sending WhatsApp Flow message', { recipientPhoneNumber, flowId });
            throw new WhatsAppError('Failed to send message flow');
        }
    }


}