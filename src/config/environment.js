import dotenv from 'dotenv';
dotenv.config();
const validateEnvVariables = () => {
  const required = [
    'WEBHOOK_VERIFY_TOKEN',
    'GRAPH_API_TOKEN',
    'CUSTOMER_CODE',
    'GTBANK_SECURE_SECRET'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please check your .env file'
    );
  }
};

// Run validation before exporting config
validateEnvVariables();

export const config = {
  webhook: {
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
    graphApiToken: process.env.GRAPH_API_TOKEN
  },
  bank_api: {
    prnDetailsEndpoint: process.env.PRN_DETAILS_ENDPOINT
  },
  payment: {
    customerCode: process.env.CUSTOMER_CODE,
    gtbankSecret: process.env.GTBANK_SECURE_SECRET,
    currency: 'UGX',
    baseUrl: process.env.GTPAY_BASE_URL
  },
  session: {
    timeout: 5 * 60 * 1000
  },
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION,
    baseUrl: process.env.WHATSAPP_BASE_URL
  }
};