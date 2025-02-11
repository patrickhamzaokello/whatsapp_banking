// this class with be to validate prns
import { PrnService } from '../services/prns.service.js';
import { UmemeService } from '../services/umeme.service.js';
import { NwscService } from '../services/nwsc.service.js';

export class PRN_Validator {

  async checkPRNStatus(prn) {
    const prnService = new PrnService();
    const result = await prnService.validatePRN(prn);
    let prn_message = "Something went wrong. Try again.";
    let status = "error"; // Default status
    let prn_amount = "na";
    let prn_tax_payer_name = "na";

    if (result.status_code === "N") {
      prn_message = `🛑 Invalid PRN ${prn}. Try again.`;
      status = "invalid";
    }

    // PRN available to pay
    if (result.status_code === "A") {
      prn_message = `Please confirm the PRN Details Below:\n\n` +
        `PRN Number: ${result.prn_number}\n` +
        `Status: ${result.status}\n` +
        `Amount: ${result.details.amount} ${result.details.currency}\n` +
        `Taxpayer Name: ${result.details.taxpayerName}\n` +
        `Expiry Date: ${result.details.expiryDate}\n` +
        `Description: ${result.details.description}\n\n`;
      status = "available";
      prn_amount = result.details.amount;
      prn_tax_payer_name = result.details.taxpayerName;
    }

    // PRN already paid. Enter new PRN
    if (result.status_code === "T") {
      prn_message = `The PRN is already Paid 😢:\n\n` +
        `PRN Number: ${result.prn_number}\n` +
        `Status: ${result.status}\n` +
        `Amount: ${result.details.amount} ${result.details.currency}\n` +
        `Taxpayer Name: ${result.details.taxpayerName}\n` +
        `Description: ${result.details.description}\n\n`;
      status = "paid";
      prn_amount = result.details.amount;
      prn_tax_payer_name = result.details.taxpayerName;
    }

    return { prn_message, prn_tax_payer_name, status, prn_amount };
  }

  async checkUMEMeMeter(meter_number, meter_type) {
    let service_message = "Something went wrong with UMEME. Try again.";
    let status = "error"; // Default status

    meter_type = meter_type.toLowerCase();

    const umemeService = new UmemeService();
    const result = await umemeService.validateUmemeMeter(meter_number, meter_type);

    if (result.status !== "1000") {
      service_message = `Invalid Umeme Details \nMeter Number: ${meter_number} \nMeter Type: ${meter_type}. \n\n Please try again.`;
      status = "invalid";
    }

    if (result.status_code === "1000") {
      service_message = `Please confirm the Umeme Meter Details Below:\n\n` +
        `Meter Number: ${result.meter_number}\n` +
        `Customer: ${result.details.message}\n` +
        `Balance: UGX ${result.details.balance}\n` +
        `Type: ${result.meterType}\n` +
        `Description: ${result.details.type}\n\n`;
      status = "available";
    }

    return { service_message, status };
  }

  async checkNWSCMeter(meter_number, area) {
    let service_message = "Something went wrong. Try again.";
    let status = "error"; // Default status

    const nwsc_service = new NwscService();
    const result = await nwsc_service.validateNwscMeter(meter_number, area);

    // if (result.status_code !== "1000") {
    //   service_message = `Invalid NWSC Details \nMeter number: ${meter_number} \nMeter area: ${area}. \n\n Please try again.`;
    //   status = "invalid";      
    // }

    // if (result.status_code === "1000") {
    //   service_message = `Please confirm the NWSC Meter Details Below:\n\n` +
    //     `Meter Number: ${result.meter_number}\n` +
    //     `Area: ${result.area}\n` +
    //     `Balance: UGX ${result.details.OutstandingBal}\n` +
    //     `Customer Name: ${result.details.Custname}\n\n`;
    //   status = "available";
    // }

    service_message = `Please confirm the NWSC Meter Details Below:\n\n` +
      `Meter Number: ${result.meter_number}\n` +
      `Area: ${result.area}\n` +
      `Balance: UGX ${result.details.OutstandingBal}\n` +
      `Customer Name: ${result.details.Custname}\n\n`;
    status = "available";

    return { service_message, status };
  }

  async checkTVNo(smart_card_no, provider) {
    let service_message = "Something went wrong. Try again.";
    let status = "error"; // Default status

    service_message = `Please confirm the Tv Details Below:\n\n` +
      `TV Account: ${smart_card_no}\n` +
      `Provider: ${provider}\n` +
      `Account Holder: Test TV customer\n`;
    status = "available";

    return { service_message, status };
  }

}
