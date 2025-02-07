// this class with be to validate prns
import axios from 'axios';
import { config } from '../config/environment.js';
import logger from '../config/logger.js';

export class UmemeService {
  constructor() {
    this.umemeDetailsEndpoint = config.bank_api.umemeDetailsEndpoint;
    this.umemeUniversalCompleteTransaction = config.bank_api.umemeUniversalCompleteTransaction;
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

  async validateUmemeMeter(meterNumber, meterType) {

    try {
      const token = await this.getToken();
      const jsonRequest = {
        "meterNumber": meterNumber,
        "meterType": meterType
      };

      const response = await axios.post(this.umemeDetailsEndpoint, jsonRequest, {
        headers: {
          'Content-Type': 'application/json',
               Authorization: `Bearer ${token}`
        }
      });

      const { Status, Code, Message, Type, Balance, Credit, YakaToken, YakaUnits, Reference } = response.data;
      const statusMap = {
        '1000': 'Valid Meter Number',
        '1002': 'Invalid Details',
      };

      return {
        status: statusMap[Code] || 'Unknown status',
        status_code: Code,
        meter_number: meterNumber,
        meterType: meterType,
        details: {
          message: Message,
          balance: Balance,
          type: Type,
        },
      };
    } catch (error) {
      logger.error('Umeme validation failed:',error)
      throw new Error(`Umeme validation failed: ${error}`);
    }
  }


  async InitiateUmemeTransaction(meterNumber, meterType, transactionID, amount, phonenumber) {
    try {

      const token = await this.getToken();
      const requestData = {
        "meterNumber": meterNumber,
        "meterType": meterType,
        "PhoneNumber": phonenumber,
        "Amount": amount,
        "RecordID": transactionID
      };

      const response = await axios.post(this.umemeUniversalCompleteTransaction, requestData, {
        headers: {
          'Content-Type': 'application/json',
               Authorization: `Bearer ${token}`
        }
      });

      const { Status, Code, Message, Type, Balance, Credit, YakaToken, YakaUnits, Reference } = response.data;
      const statusMap = {
        '1000': 'Umeme Transaction Initiated Successfully',
        '1004': 'Valid Umeme Details',
      };

      return {
        status: statusMap[Code] || 'Unknown status',
        status_code: Code,
        status_description: Message,
        meter_number: meterNumber,
        reference: Reference,
        details: {
          balance: Balance,
          credit: Credit,
          yaka_token: YakaToken,
          yaka_units: YakaUnits,
          type: Type,
        }
      };
    } catch (error) {
      throw new Error(`Unable to intiate Umeme Transaction Completion: ${error}`)
    }
  }



}
