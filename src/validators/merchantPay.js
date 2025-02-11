// this class with be to validate prns
import { MerchantService } from "../services/merchant.service.js";

export class MerchantFlowValidator {
  async fetchMerchantDetails(
    merchant_code_input,
    payment_phone_number,
    payment_amount
  ) {
    let service_message =
      "Unable to complete your request at this time, please try again later.";
    let status = "error";

    // validate phone number
    const { valid, phone } = await this.validatePhoneNumber(
      payment_phone_number
    );
    if (!valid) {
      service_message = `⛔ Invalid phone number ${payment_phone_number}, please ensure that you have entered the correct phone number and try again.\n`;
      status = "invalid";
      return { service_message, status };
    }

    // validate amount, nothing below 500
    if (payment_amount <= 500) {
      service_message = `⛔ Invalid amount ${payment_amount} UGX, please ensure that you have entered the correct amount and try again.\n`;
      status = "invalid";
      return { service_message, status };
    }

    const merchant_service = new MerchantService();
    const { status_code, merchant_name } =
      await merchant_service.validateMerchantCode(merchant_code_input);

    if (status_code !== "1000") {
      service_message = `⛔ Invalid Merchant Details, please ensure that you have entered the correct  merchant code and try again.\n`;
      status = "invalid";
    }

    if (status_code === "1000") {
      service_message = `✅ Please confirm the details below and initiate payment. \n\nMerchant Name: ${merchant_name}`;
      status = "valid";
    }

    return { service_message, status };
  }

  async validatePhoneNumber(phoneNumber) {
    // Accepts formats: 256XXXXXXXXX, 0XXXXXXXXX, +256XXXXXXXXX (valid mobile numbers)
    const phoneRegex = /^(?:256|\+256|0)?(7[0-9]{8})$/;

    // Remove any spaces, hyphens, or other unwanted characters
    const cleanPhoneNumber = phoneNumber.replace(/[\s-]/g, "");

    // Standardize the phone number format
    const formatPhoneNumber = (number) => {
      if (number.startsWith("0")) {
        return "256" + number.substring(1);
      }
      if (number.startsWith("+")) {
        return number.substring(1);
      }
      return number;
    };

    const match = cleanPhoneNumber.match(phoneRegex);
    const isValidPhone = !!match;

    if (isValidPhone) {
      // Format phone number to standard format (256XXXXXXXXX)
      return { valid: true, phone: formatPhoneNumber(cleanPhoneNumber) };
    }

    return { valid: false, phone: phoneNumber };
  }
}
