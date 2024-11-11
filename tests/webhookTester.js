import logger from '../src/config/logger.js';
import { TestMessageHandler } from '../src/handlers/test.message.handler.js';
import { performance } from 'perf_hooks';

class WebhookTester {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTime: 0,
      averageResponseTime: 0,
      concurrentRequests: 0,
      maxConcurrent: 0,
      errors: []
    };
    this.activeRequests = 0;
  }

  createWebhookPayload(index) {
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
                name: `Test User ${index}`
              },
              wa_id: `2567${index.toString().padStart(9, '0')}`
            }],
            messages: [{
              from: `2567${index.toString().padStart(9, '0')}`,
              id: `wamid.test${index}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              text: {
                body: this.getRandomMessageType()
              },
              type: "text"
            }]
          },
          field: "messages"
        }]
      }]
    };
  }

  getRandomMessageType() {
    const messageTypes = [
      'pay tv',
      'pay water',
      'pay umeme',
      'pay prn',
      'menu',
      'about',
      'contact',
      'faq',
      '7250000042007'  // Added actual message example from your data
    ];
    return messageTypes[Math.floor(Math.random() * messageTypes.length)];
  }

  async testSingleWebhook(index) {
    const startTime = performance.now();
    this.activeRequests++;
    this.results.maxConcurrent = Math.max(this.results.maxConcurrent, this.activeRequests);

    try {
      const webhookPayload = this.createWebhookPayload(index);
      const message = webhookPayload.entry[0].changes[0].value.messages[0];
      const contact = webhookPayload.entry[0].changes[0].value.contacts[0];
      const businessPhoneNumberId = webhookPayload.entry[0].changes[0].value.metadata.phone_number_id;

      await TestMessageHandler.handleIncomingWithQueue(message, contact, businessPhoneNumberId);
      
      this.results.successfulRequests++;
      
      const endTime = performance.now();
      const responseTime = endTime - startTime;
      this.results.totalTime += responseTime;

      logger.info('Webhook test processed successfully', {
        messageId: message.id,
        responseTime: `${responseTime.toFixed(2)}ms`,
        concurrent: this.activeRequests
      });

    } catch (error) {
      this.results.failedRequests++;
      this.results.errors.push({
        requestIndex: index,
        error: error.message
      });

      logger.error('Webhook test failed', {
        requestIndex: index,
        error: error.message
      });
    } finally {
      this.activeRequests--;
    }
  }

  async runLoadTest({
    totalRequests = 100,
    batchSize = 10,
    delayBetweenBatches = 1000,
    testName = 'Load Test'
  }) {
    console.log(`\n=== Starting ${testName} ===\n`);
    console.log(`Total Webhook Requests: ${totalRequests}`);
    console.log(`Concurrent Batch Size: ${batchSize}`);
    console.log(`Delay Between Batches: ${delayBetweenBatches}ms\n`);

    const startTime = performance.now();
    this.results.totalRequests = totalRequests;

    for (let i = 0; i < totalRequests; i += batchSize) {
      const batch = [];
      const batchEnd = Math.min(i + batchSize, totalRequests);
      
      for (let j = i; j < batchEnd; j++) {
        batch.push(this.testSingleWebhook(j));
      }

      await Promise.all(batch);
      
      if (i + batchSize < totalRequests) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const totalTestTime = performance.now() - startTime;
    
    this.results.averageResponseTime = this.results.totalTime / this.results.successfulRequests;
    this.results.totalTestTime = totalTestTime;
    this.results.requestsPerSecond = (this.results.successfulRequests / totalTestTime) * 1000;

    this.printResults(testName);
    return this.results;
  }

  printResults(testName) {
    console.log(`\n=== ${testName} Results ===\n`);
    console.log(`Total Webhook Requests: ${this.results.totalRequests}`);
    console.log(`Successful: ${this.results.successfulRequests}`);
    console.log(`Failed: ${this.results.failedRequests}`);
    console.log(`Success Rate: ${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%`);
    console.log(`\nPerformance Metrics:`);
    console.log(`Total Test Time: ${(this.results.totalTestTime / 1000).toFixed(2)} seconds`);
    console.log(`Average Response Time: ${this.results.averageResponseTime.toFixed(2)}ms`);
    console.log(`Requests Per Second: ${this.results.requestsPerSecond.toFixed(2)}`);
    console.log(`Max Concurrent Requests: ${this.results.maxConcurrent}`);
    
    if (this.results.errors.length > 0) {
      console.log('\nErrors:');
      this.results.errors.forEach(error => {
        console.log(`- Request ${error.requestIndex}: ${error.error}`);
      });
    }
  }
}

export default WebhookTester;