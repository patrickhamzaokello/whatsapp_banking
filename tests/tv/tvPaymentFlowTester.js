import logger from '../../src/config/logger.js';
import { TestMessageHandler } from '../../src/handlers/test.message.handler.js';
import { performance } from 'perf_hooks';

class TVPaymentFlowTester {
    constructor() {
        this.results = {
            flowSteps: [],
            errors: [],
            success: false,
            totalTime: 0
        };
    }

    // Define expected flow steps and responses
    flowSteps = {
        INITIAL: {
            message: 'pay tv',
            expectedResponse: ['𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝘆𝗼𝘂𝗿 𝗧𝗩 𝗻𝘂𝗺𝗯𝗲𝗿'],
            expectedFlowState: 'validateTvNumber'
        },
        ACCOUNT_NUMBER: {
            message: '12345',
            expectedResponse: ['confirm', 'account details'], // Expecting response to show account details and ask for confirmation
            expectedFlowState: 'requestPaymentMethod'
        },
        CONFIRM: {
            message: 'confirm',
            expectedResponse: ['choose your preferred payment method', 'Visa/Mastercard payment'],
            expectedFlowState: 'validatePaymentMethod'
        },
        PAYMENMETHOD: {
            message: 'mobile',
            expectedResponse: ['enter the  phone number', 'used to make payment'],
            expectedFlowState: 'validatePhoneNumber'
        },
        PHONE_NUMBER: {
            message: '256787250196',
            expectedResponse: ['payment prompt to your phone', 'please check your phone', 'to complete the transaction'], // Expecting some kind of success message
            expectedFlowState: 'COMPLETE'
        }
    };

    createWebhookPayload(userId, messageText) {
        return {
            object: "whatsapp_business_account",
            entry: [{
                id: "486430251213015",
                changes: [{
                    value: {
                        messaging_product: "whatsapp",
                        metadata: {
                            display_phone_number: "256703718500",
                            phone_number_id: "471930742669654"
                        },
                        contacts: [{
                            profile: {
                                name: `Test User`
                            },
                            wa_id: userId
                        }],
                        messages: [{
                            from: userId,
                            id: `wamid.test${Date.now()}`,
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            text: {
                                body: messageText
                            },
                            type: "text"
                        }]
                    },
                    field: "messages"
                }]
            }]
        };
    }

    validateResponse(stepName, response, flowState) {
        const step = this.flowSteps[stepName];

        // Check if response contains expected phrases
        const containsAllPhrases = step.expectedResponse.some(phrase =>
            response.toLowerCase().includes(phrase.toLowerCase())
        );

        // Check if flow state matches expected
        const correctFlowState = flowState === step.expectedFlowState;

        return {
            valid: containsAllPhrases && correctFlowState,
            error: !containsAllPhrases
                ? `Response missing expected phrases. Got: "${response}"`
                : !correctFlowState
                    ? `Incorrect flow state. Expected ${step.expectedFlowState}, got ${flowState}`
                    : null
        };
    }

    async runStep(userId, stepName) {
        try {
            const step = this.flowSteps[stepName];
            const webhookPayload = this.createWebhookPayload(userId, step.message);
            const message = webhookPayload.entry[0].changes[0].value.messages[0];
            const contact = webhookPayload.entry[0].changes[0].value.contacts[0];
            const businessPhoneNumberId = webhookPayload.entry[0].changes[0].value.metadata.phone_number_id;

            const startTime = performance.now();

            // Get the response from your MessageHandler
            const { response, flowState } = await TestMessageHandler.handleIncoming(
                message,
                contact,
                businessPhoneNumberId
            );
            const endTime = performance.now();
            const stepTime = endTime - startTime;

            // Validate the response
            const validation = this.validateResponse(stepName, response, flowState);

            // Record step results
            this.results.flowSteps.push({
                step: stepName,
                message: step.message,
                response: response,
                flowState: flowState,
                valid: validation.valid,
                error: validation.error,
                time: stepTime
            });

            this.results.totalTime += stepTime;

            return validation.valid;

        } catch (error) {
            this.results.errors.push({
                step: stepName,
                error: error.message
            });
            return false;
        }
    }

    async runFullFlow() {
        console.log('\n=== Starting TV Payment Flow Test ===\n');

        const userId = '256787250196'; // Test user ID
        let allStepsValid = true;

        // Run each step in sequence
        for (const stepName of Object.keys(this.flowSteps)) {
            console.log(`Testing step: ${stepName}`);

            const stepValid = await this.runStep(userId, stepName);
            if (!stepValid) {
                allStepsValid = false;
                break;
            }

            // Add small delay between steps to simulate real user interaction
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.results.success = allStepsValid;
        this.printResults();
        return this.results;
    }

    printResults() {
        console.log('\n=== TV Payment Flow Test Results ===\n');
        console.log(`Overall Status: ${this.results.success ? 'PASSED ✅' : 'FAILED ❌'}`);
        console.log(`Total Time: ${(this.results.totalTime / 1000).toFixed(2)} seconds\n`);

        console.log('Step-by-Step Results:');
        this.results.flowSteps.forEach((step, index) => {
            console.log(`\nStep ${index + 1}: ${step.step}`);
            console.log(`Message: "${step.message}"`);
            console.log(`Response: "${step.response}"`);
            console.log(`Flow State: ${step.flowState}`);
            console.log(`Status: ${step.valid ? 'PASSED ✅' : 'FAILED ❌'}`);
            if (!step.valid) {
                console.log(`Error: ${step.error}`);
            }
            console.log(`Time: ${step.time.toFixed(2)}ms`);
        });

        if (this.results.errors.length > 0) {
            console.log('\nErrors:');
            this.results.errors.forEach(error => {
                console.log(`- Step ${error.step}: ${error.error}`);
            });
        }
    }
}

export default TVPaymentFlowTester;