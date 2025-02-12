// this class with be to validate prns
import axios from 'axios';
import { config } from '../config/environment.js';
import logger from '../config/logger.js';

export class PrnService {
  constructor() {
    this.apiPrnDetailsEndpoint = config.bank_api.prnDetailsEndpoint;
    this.apiPrnCompleteTransaction = config.bank_api.prnUniversalUraCompleteTransaction;
    this.TokenEndpoint = config.bank_api.middleware_authentication;
    this.token = null;
    this.tokenExpiry = null;
  }

  async fetchToken() {
    try {
      const requestData = {
        username: config.bank_api.middleware_username,
        password: config.bank_api.middleware_password
      };

      const response = await axios.post(this.TokenEndpoint, requestData, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.token = response.data.accessToken;
      // this.tokenExpiry = Date.now() + 3 * 60 * 1000; // Token is valid for 3 minutes
      this.tokenExpiry = response.data.expiry;
      logger.info('Token retrieved successfully');
    } catch (error) {
      logger.error('Failed to fetch token:', error);
      throw new Error(`Unable to fetch token: ${error.message}`);
    }
  }

  async getToken() {
    if (!this.token || Date.now() > this.tokenExpiry) {
      await this.fetchToken();
    }
    return this.token;
  }

  async validatePRN(prn) {

    try {
      const response = await this.getPRNDetails(prn);
      return this.formatPrnDetailsResponse(response);
    } catch (error) {
      // console.log('prn validation failed',error)
      throw new Error(`PRN validation failed: ${error}`);
    }
  }

  async universialPRNCompleteTransaction(TXN_ID, prn, phonenumber) {
    try {
      const response = await this.getUniversalUraCompleteTransaction(TXN_ID, prn, phonenumber);
      return this.formatUniversalCompleteTransactionResponse(response);
    } catch (error) {
      throw new Error(`Unable to intiate PRN Transaction Completion: ${error}`)
    }
  }

  async getPRNDetails(prn) {

    const token = await this.getToken();
    const jsonRequest = {
      prn: prn
    };

    const response = await axios.post(this.apiPrnDetailsEndpoint, jsonRequest, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  }


  async getUniversalUraCompleteTransaction(TXN_ID, prn, phonenumber) {

    const token = await this.getToken();
    const requestData = {
      TranID: TXN_ID,
      prn: prn,
      phonenumber: phonenumber
    };

    const response = await axios.post(this.apiPrnCompleteTransaction, requestData, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    return response.data;
  }





  async formatUniversalCompleteTransactionResponse(prnResult) {
    try {
      const { Status, Code, Prn, Reference } = prnResult;
      const statusMap = {
        '1013': 'Invalid PRN',
        '1000': 'Valid PRN Details',
      };

      return {
        status: statusMap[Code] || 'Unknown status',
        status_code: Code,
        status_description: Status,
        prn_number: Prn,
        reference: Reference,
      };
    } catch (error) {
      throw new Error(`Failed to parse and format the inner XML content: ${error}`);
    }
  }

  formatPrnDetailsResponse(prnResult) {

    const { URAStatusCode, StatusDesc, Amount, CurrencyCode, PaymentExpiryDate, TaxPayerName, Prn } = prnResult;
    const statusMap = {
      N: 'Invalid PRN',
      A: 'Available for payment',
      T: 'PRN already paid',
    };

    return {
      status: statusMap[URAStatusCode] || 'Unknown status',
      status_code: URAStatusCode,
      prn_number: Prn,
      details: {
        description: StatusDesc,
        amount: Amount,
        currency: CurrencyCode,
        expiryDate: PaymentExpiryDate,
        taxpayerName: TaxPayerName,
      },
    };
  }
}
