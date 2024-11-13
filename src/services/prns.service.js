// this class with be to validate prns
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import { config } from '../config/environment.js';

export class PrnService {
  constructor() {
    this.apiPrnDetailsEndpoint = config.bank_api.prnDetailsEndpoint;
    this.apiPrnCompleteTransaction = config.bank_api.prnUniversalUraCompleteTransaction;
  }

  async validatePRN(prn) {

    try {
      const response = await this.getPRNDetails(prn);
      const result = await this.parsePRNDetailsSoapResponse(response);
      return this.formatPrnDetailsResponse(result);
    } catch (error) {
      throw new Error(`PRN validation failed: ${error}`);
    }
  }

  async universialPRNCompleteTransaction(prn, phonenumber) {
    try {
      const response = await this.getUniversalUraCompleteTransaction(prn, phonenumber);
      const result = await this.parsePrnCompleteTransactionSoapResponse(response);
      return this.formatUniversalCompleteTransactionResponse(result);
    } catch (error) {
      throw new Error(`Unable to intiate PRN Transaction Completion: ${error}`)
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

    const response = await axios.post(this.apiPrnDetailsEndpoint, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8'
      }
    });

    return response.data;
  }


  async getUniversalUraCompleteTransaction(prn, phonenumber) {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <UniversalUraCompleteTransaction xmlns="http://tempuri.org/">
      <PhoneNumber>${phonenumber}</PhoneNumber>
      <Prn>${prn}</Prn>
    </UniversalUraCompleteTransaction>
  </soap:Body>
</soap:Envelope>`;

    const response = await axios.post(this.apiPrnCompleteTransaction, soapRequest, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8'
      }
    });

    return response.data;
  }


  async parsePRNDetailsSoapResponse(xml) {
    try {
      const parsedData = await parseStringPromise(xml, { explicitArray: false });
      return parsedData['soap:Envelope']['soap:Body']['GetPRNDetails_GTPayResponse']['GetPRNDetails_GTPayResult'];
    } catch (error) {
      throw new Error('Failed to parse SOAP response');
    }
  }

  async parsePrnCompleteTransactionSoapResponse(soapResponse) {
    try {
      const parsedResult = await parseStringPromise(this.decodeHtmlEntities(soapResponse), { explicitArray: false });
      return parsedResult['soap:Envelope']['soap:Body']['UniversalUraCompleteTransactionResponse']['UniversalUraCompleteTransactionResult'];
    } catch (error) {
      throw new Error('Failed to parse universal SOAP response');
    }
  }
 
  async formatUniversalCompleteTransactionResponse(prnResult){
    try {
      const { STATUS, CODE, PRN, REFERENCE } = prnResult;
      const statusMap = {
        '1013': 'Invalid PRN',
        '1000': 'Valid PRN Details',
      };

      return {
        status: statusMap[CODE] || 'Unknown status',
        status_code: CODE,
        status_description: STATUS,
        prn_number: PRN,
        reference: REFERENCE,
      };
    } catch (error) {
      console.error("Failed to parse and format the inner XML content:", error);
      return null;
    }
  }

  formatPrnDetailsResponse(prnResult) {
    const { StatusCode, StatusDesc, Amount, CurrencyCode, ExpiryDt, TaxpayerName, Prn } = prnResult;
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

  decodeHtmlEntities(encodedString) {
    return encodedString
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
  };
}
