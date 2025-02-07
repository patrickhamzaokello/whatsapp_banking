// this class with be to validate prns
import { MerchantService } from '../services/merchant.service.js';

export class MerchantFlowValidator {

  async fetchMerchantDetails(prn) {
    let service_message = "Unable to complete your request at this time, please try again later.";
    let status = "error"; 

    meter_type = meter_type.toLowerCase();

    const merchant_service = new MerchantService();
    const result = await merchant_service.validateUmemeMeter(meter_number, meter_type);

    if (result.status !== "1000") {
      service_message = `Invalid Merchant Details, please ensure that you have entered the correct  merchant code and try again`;
      status = "invalid";
    }

    if (result.status_code === "1000") {
      service_message = `Please confirm the details below and initiate payment. \n\nMerchant name: Agro Enterprise kla, Uganda.`;
      status = "valid";
    }

    return { service_message, status };
  }

  async validatePhonenumber(phoneNumber) {

    // Accepts formats: 256XXXXXXXXX, 0XXXXXXXXX, +256XXXXXXXXX
    const phoneRegex = /^(?:256|\+256|0)?([17]\d{8}|[2-9]\d{8})$/;

    // Remove any spaces, hyphens or other characters
    const cleanPhoneNumber = phoneNumber.replace(/[\s-]/g, '');

    // Standardize the phone number format
    const formatPhoneNumber = (number) => {
      if (number.startsWith('0')) {
        return '256' + number.substring(1);
      }
      if (number.startsWith('+')) {
        return number.substring(1);
      }
      return number;
    };

    const isValidPhone = phoneRegex.test(cleanPhoneNumber);

    if (isValidPhone) {
      // Format phone number to standard format (256XXXXXXXXX)
      const standardizedPhone = formatPhoneNumber(cleanPhoneNumber);
      return { status: isValidPhone, phone: standardizedPhone }

    }

    return { status: isValidPhone, phone: phoneNumber }

  }


}
