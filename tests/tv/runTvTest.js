import TVPaymentFlowTester from './tvPaymentFlowTester.js';

async function runTest() {
  const tester = new TVPaymentFlowTester();
  
  try {
    await tester.runFullFlow();
  } catch (error) {
    console.error('Test failed:', error);
  }
}

console.log('Starting TV Payment Flow Test...');
runTest()
  .then(() => console.log('\nTest completed'))
  .catch(error => console.error('\nTest suite failed:', error));