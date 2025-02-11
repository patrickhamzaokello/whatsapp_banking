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

const buildEndpoint = (baseUrl, endpoint) => {
  return `${baseUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
}

// Run validation before exporting config
validateEnvVariables();

export const config = {
  webhook: {
    verifyToken: process.env.WEBHOOK_VERIFY_TOKEN,
    graphApiToken: process.env.GRAPH_API_TOKEN
  },
  bank_api: {
    middleware_base_url: process.env.GTBANK_MW_BASEURL,

    middleware_authentication: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.MIDDLEWARE_AUTH_ENDPOINT),
    middleware_username: process.env.MIDDLEWARE_USERNAME,
    middleware_password: process.env.MIDDLEWARE_PASSWORD,
    
    prnDetailsEndpoint: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.PRN_DETAILS_ENDPOINT),
    prnUniversalUraCompleteTransaction: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.PRN_UNI_COMPT_ENDPOINT),

    umemeDetailsEndpoint: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.UMEME_DETAILS_ENDPOINT),
    umemeUniversalCompleteTransaction: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.UMEME_COMPT_ENDPOINT),

    NwscDetailsEndpoint: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.NWSC_DETAILS_ENDPOINT),
    NwscUniversalCompleteTransaction: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.NWSC_COMPT_ENDPOINT),


    merchantDetailsEndpoint: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.MERCHANT_DETAILS_ENDPOINT),
    merchantCollectTransaction: buildEndpoint(process.env.GTBANK_MW_BASEURL, process.env.MERCHANT_COMPT_ENDPOINT),

  },
  payment: {
    customerCode: process.env.CUSTOMER_CODE,
    gtbankSecret: process.env.GTBANK_SECURE_SECRET,
    currency: 'UGX',
    baseUrl: process.env.GTPAY_BASE_URL,
    prnBaseUrl: process.env.GTPAY_PRN_BASE_URL,
    utilityBaseUrl: process.env.GTPAY_UTILITY_BASE_URL
  },
  session: {
    timeout: 5 * 60 * 1000
  },
  whatsapp: {
    apiVersion: process.env.WHATSAPP_API_VERSION,
    baseUrl: process.env.WHATSAPP_BASE_URL,
    phoneNumberId: process.env.WHATSAPP_PHONENUMBERID
  },
  database: {
    DB_SERVER: process.env.DB_SERVER,
    DB_USERNAME: process.env.DB_USERNAME,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_ENCRYPT: process.env.DB_ENCRYPT,
    DB_TRUST_CERT: process.env.DB_TRUST_CERT,
    DB_NAME: process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    DB_CONNECTION_TIMEOUT: process.env.DB_CONNECTION_TIMEOUT,
    DB_REQUEST_TIMEOUT: process.env.DB_REQUEST_TIMEOUT,
  }
};