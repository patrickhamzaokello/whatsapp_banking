import WebhookTester from './webhookTester.js';

async function runTests() {
  const tester = new WebhookTester();
  
  const testScenarios = [
    {
      name: 'Light Load Test',
      config: {
        totalRequests: 1000,
        batchSize: 50,
        delayBetweenBatches: 100
      }
    },
    // {
    //   name: 'Normal Load Test',
    //   config: {
    //     totalRequests: 50,
    //     batchSize: 5,
    //     delayBetweenBatches: 500
    //   }
    // },
    // {
    //   name: 'Peak Load Test',
    //   config: {
    //     totalRequests: 100,
    //     batchSize: 10,
    //     delayBetweenBatches: 250
    //   }
    // },
    // {
    //   name: 'Stress Test',
    //   config: {
    //     totalRequests: 200,
    //     batchSize: 20,
    //     delayBetweenBatches: 100
    //   }
    // }
  ];

  for (const scenario of testScenarios) {
    try {
      await tester.runLoadTest({
        ...scenario.config,
        testName: scenario.name
      });
      
      // Wait between test scenarios
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error in ${scenario.name}:`, error);
    }
  }
}

// Run all test scenarios
console.log('Starting WhatsApp Webhook Load Tests...');
runTests()
  .then(() => console.log('\nAll test scenarios completed'))
  .catch(error => console.error('Test suite failed:', error));