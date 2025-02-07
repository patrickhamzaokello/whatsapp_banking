import axios from 'axios';
import { config } from '../config/environment.js';
import logger from '../config/logger.js';

export class NwscService {
  constructor() {
    this.NwscDetailsEndpoint = config.bank_api.NwscDetailsEndpoint;
    this.NwscUniversalCompleteTransaction = config.bank_api.NwscUniversalCompleteTransaction;
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

  async validateNwscMeter(meterNumber, meter_area) {
    try {
      const token = await this.getToken();

      const jsonRequest = {
        meterNumber: meterNumber,
        area: meter_area
      };

      const response = await axios.post(this.NwscDetailsEndpoint, jsonRequest, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const { Code, Area, Custref, CustomerError, StatusDescription, Custname, StatusCode, OutstandingBal } = response.data;
      const statusMap = {
        '1000': 'Valid Meter Number',
        '1002': 'Invalid Details',
      };

      return {
        status: statusMap[Code] || 'Unknown status',
        status_code: Code,
        meter_number: meterNumber,
        area: Area,
        details: {
          Custref: Custref,
          CustomerError: CustomerError,
          StatusDescription: StatusDescription,
          Custname: Custname,
          StatusCode: StatusCode,
          OutstandingBal: OutstandingBal
        },
      };
    } catch (error) {
      logger.error('Nwsc validation failed:', error);
      throw new Error(`Nwsc validation failed: ${error.message}`);
    }
  }

  async InitiateNwscTransaction(meterNumber, area, transactionID, amount, phonenumber) {
    try {
      const token = await this.getToken();

      const requestData = {
        meterNumber: meterNumber,
        area: area,
        PhoneNumber: phonenumber,
        amount: amount,
        tranID: transactionID
      };

      const response = await axios.post(this.NwscUniversalCompleteTransaction, requestData, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const { Status, Code, Refference, meterMeter, Amount } = response.data;
      const statusMap = {
        '1000': 'Nwsc Transaction Initiated Successfully',
        '1004': 'Valid Nwsc Details',
      };

      return {
        status: statusMap[Code] || 'Unknown status',
        status_code: Code,
        meter_number: meterNumber,
        reference: Refference,
        details: {
          meterMeter: meterMeter,
          Amount: Amount,
        }
      };
    } catch (error) {
      logger.error('Failed to initiate NWSC transaction:', error);
      throw new Error(`Unable to initiate NWSC Transaction Completion: ${error.message}`);
    }
  }
}
