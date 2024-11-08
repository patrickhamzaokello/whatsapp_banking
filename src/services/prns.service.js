// this class with be to validate prns
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import {config} from '../config/environment.js';

export class PrnService {
  constructor() {
    this.apiEndpoint = config.bank_api.prnDetailsEndpoint;
  }

  async validatePRN(prn) {

    try {
      const response = await this.getPRNDetails(prn);
      const result = await this.parseSoapResponse(response);
      return this.formatPrnResponse(result);
    } catch (error) {
      throw new Error(`PRN validation failed: ${error}`);
    }
  }

  async getPRNDetails(prn) {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetPRNDetails_GTPay xmlns="http://tempuri.org/">
          <prn>${prn}</prn>
        </GetPRNDetails_GTPay>
      </soap:Body>
    </soap:Envelope>`;

    const response = await axios.post(this.apiEndpoint, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8'
      }
    });

    return response.data;
  }

 

  async parseSoapResponse(xml) {
    try {
      const parsedData = await parseStringPromise(xml, { explicitArray: false });
      return parsedData['soap:Envelope']['soap:Body']['GetPRNDetails_GTPayResponse']['GetPRNDetails_GTPayResult'];
    } catch (error) {
      throw new Error('Failed to parse SOAP response');
    }
  }

  formatPrnResponse(prnResult) {
    const { StatusCode, StatusDesc, Amount, CurrencyCode, ExpiryDt, TaxpayerName,Prn } = prnResult;
    const statusMap = {
      N: 'Invalid PRN',
      A: 'Available for payment',
      T: 'PRN already paid',
    };

    return {
      status: statusMap[StatusCode] || 'Unknown status',
      status_code: StatusCode,
      prn_number: Prn,
      details: {
        description: StatusDesc,
        amount: Amount,
        currency: CurrencyCode,
        expiryDate: ExpiryDt,
        taxpayerName: TaxpayerName,
      },
    };
  }
}
