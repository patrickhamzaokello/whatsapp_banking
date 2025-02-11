// this class with be to validate prns
import axios from "axios";
import { config } from "../config/environment.js";
import logger from "../config/logger.js";

export class MerchantService {
  constructor() {
    this.merchantDetails = config.bank_api.merchantDetailsEndpoint;
    this.collectMerchantPayment = config.bank_api.merchantCollectTransaction;
    this.TokenEndpoint = config.bank_api.middleware_authentication;
    this.token = null;
    this.tokenExpiry = null;
  }

  async fetchToken() {
    try {
      const requestData = {
        username: config.bank_api.middleware_username,
        password: config.bank_api.middleware_password,
      };

      const response = await axios.post(this.TokenEndpoint, requestData, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      this.token = response.data.accessToken;
      // this.tokenExpiry = Date.now() + 3 * 60 * 1000; // Token is valid for 3 minutes
      this.tokenExpiry = response.data.expiry;
      logger.info("Token retrieved successfully");
    } catch (error) {
      logger.error("Failed to fetch token:", error);
      throw new Error(`Unable to fetch token: ${error.message}`);
    }
  }

  async getToken() {
    if (!this.token || Date.now() > this.tokenExpiry) {
      await this.fetchToken();
    }
    return this.token;
  }

  async validateMerchantCode(merchant_code) {
    try {
      const token = await this.getToken();
      const jsonRequest = {
        merchantCode: merchant_code,
      };

      const response = await axios.post(this.merchantDetails, jsonRequest, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const {
        code,
        status,
        merchantId,
        username,
        float_account
      } = response.data;
      const statusMap = {
        1000: "Valid Merchant Code",
        1002: "Invalid Details",
      };

      return {
        status: statusMap[code] || "Unknown status",
        status_code: code,
        merchant_code: merchant_code,
        merchant_name: username,
      };
    } catch (error) {
      return {
        status: "Failed",
        status_code: 500,
        merchant_code: merchant_code,
        error_message: error.message,
      }
    }
  }

  async InitiateMerchantPayment(
    merchant_code,
    transactionID,
    amount,
    phonenumber
  ) {
    try {
      const token = await this.getToken();
      const requestData = {
        transactionReference: transactionID,
        customerCode: merchant_code,
        MSISDN: "sample string 3",
        amount: amount,
        remarks: phonenumber,
      };

      const response = await axios.post(
        this.collectMerchantPayment,
        requestData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const {
        Status,
        Code,
        Message,
        Type,
        Balance,
        Credit,
        YakaToken,
        YakaUnits,
        Reference,
      } = response.data;
      const statusMap = {
        1000: "Merchant Transaction Initiated Successfully",
        1004: "Valid Merchant Details",
      };

      return {
        status: statusMap[Code] || "Unknown status",
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
        },
      };
    } catch (error) {
      throw new Error(
        `Unable to intiate Merchant Transaction Completion: ${error}`
      );
    }
  }
}
