import sql from 'mssql';
import { config } from './environment.js';
import { BillTypes } from '../constants/constants.js';

// Configuration object for the database
const config_str = {
  user: config.database.DB_USERNAME,
  password: config.database.DB_PASSWORD,
  server: config.database.DB_SERVER,
  database: config.database.DB_NAME,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// Database class to handle all database operations
class Database {
  constructor() {
    this.pool = null;
  }

  // Establish connection pool
  async connect() {
    try {
      if (!this.pool) {
        this.pool = await sql.connect(config_str);
        console.log('Database connection pool established');
      }
      return this.pool;
    } catch (err) {
      console.error('Database connection error:', err);
      throw err;
    }
  }

  // Execute a query
  async query(queryString, params = {}) {
    try {
      await this.connect();

      const request = new sql.Request();

      // Add parameters if provided
      Object.keys(params).forEach((key) => {
        request.input(key, params[key]);
      });

      // Execute the query
      const result = await request.query(queryString);
      return result.recordset;
    } catch (err) {
      console.error('Query execution error:', err);
      throw err;
    }
  }


  async getOrCreateUser(phoneNumber, fullName = null) {
    try {
      await this.connect();

      const request = new sql.Request();
      request.input('PhoneNumber', sql.VarChar(15), phoneNumber);
      request.input('FullName', sql.NVarChar(100), fullName); // Optional
      request.output('UserID', sql.UniqueIdentifier); // Define the output parameter

      // Execute the stored procedure
      const result = await request.execute('GetOrCreateUser');

      const userId = result.output.UserID || request.parameters.UserID.value;

      // Return the UserID from the output
      return userId;
    } catch (err) {
      console.error('Error executing GetOrCreateUser:', err);
      throw err;
    }
  }

  // create flow form 
  async insertFlowForm(userId, flow_token) {
    try {
      await this.connect();

      const request = new sql.Request();
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('FlowToken', sql.NVarChar(255), flow_token);

      // Execute the insert and return the inserted FlowFormID
      const result = await request.query(`
            INSERT INTO FlowForms
            (UserID, FlowToken)
            VALUES
            (@UserID, @FlowToken);
            SELECT SCOPE_IDENTITY() AS ID;
        `);

      // Return the inserted FlowFormID
      return result.recordset[0].ID;
    } catch (err) {
      console.error('Error executing insertFlowForm:', err);
      throw err;
    }
  }



  // Insert data into a table
  async insertMessageLog(userId, wamid, messageContent, messageDirection, messageSource = null, platform = 'WhatsApp') {
    try {
      await this.connect();

      const request = new sql.Request();

      // Input parameters for the message log
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('WAMID', sql.NVarChar(255), wamid);
      request.input('MessageContent', sql.NVarChar, messageContent);
      request.input('MessageDirection', sql.Char, messageDirection);

      // Optional parameters with defaults
      if (messageSource) {
        request.input('MessageSource', sql.NVarChar(100), messageSource);
      }
      request.input('Platform', sql.NVarChar(50), platform);

      // Execute the insert and return the inserted MessageID
      const result = await request.query(`
            INSERT INTO UserMessages 
            (UserID, WAMID, MessageContent, MessageDirection, MessageSource, Platform)
            VALUES 
            (@UserID, @WAMID, @MessageContent, @MessageDirection, 
             ${messageSource ? '@MessageSource' : 'NULL'}, @Platform);
            
            SELECT SCOPE_IDENTITY() AS MessageID;
        `);

      // Return the MessageID of the inserted message
      return result.recordset[0].MessageID;
    } catch (err) {
      console.error('Error inserting message log:', err);
      throw err;
    }
  }

  

  async insertTransaction(flowData, userId, message_id, from_contact) {
    try {
      await this.connect();

      const request = new sql.Request();

      // Prepare columns and values arrays
      let columns = ['FlowToken', 'UserID', 'BillType', 'PaymentMethod', 'Amount', 'TransactionStatus', 'MessageID', 'MessageFrom'];
      let values = ['@FlowToken', '@UserID', '@BillType', '@PaymentMethod', '@Amount', '@TransactionStatus', '@MessageID', '@MessageFrom'];

      // Prepare transaction parameters
      request.input('FlowToken', sql.NVarChar(255), flowData.flow_token);
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('BillType', sql.NVarChar(20)); 
      request.input('PaymentMethod', sql.NVarChar(20)); 
      request.input('Amount', sql.Decimal(18, 2), flowData.s_amount);
      request.input('TransactionStatus', sql.NVarChar(20), 'Pending');      
      request.input('MessageID', sql.NVarChar(255), message_id);
      request.input('MessageFrom', sql.NVarChar(20), from_contact);
      // Optional additional details
      const billDetails = {
        is_prn: flowData.is_prn,
        is_nwsc: flowData.is_nwsc,
        is_tv: flowData.is_tv,
        is_yaka: flowData.is_yaka,
        is_mobile: flowData.is_mobile,
        s_amount: flowData.s_amount,
        is_account: flowData.is_account,
        s_prn_number: flowData.s_prn_number,
        s_nwsc_meter_no: flowData.s_nwsc_meter_no,
        s_nwsc_area_selected: flowData.s_nwsc_area_selected,
        s_umeme_meter_type: flowData.s_umeme_meter_type,
        s_umeme_meter_no: flowData.s_umeme_meter_no,
        s_tv_provider_selected: flowData.s_tv_provider_selected,
        s_tv_card_no: flowData.s_tv_card_no,
        s_selected_bank_service: flowData.s_selected_bank_service,
        s_service_message: flowData.s_service_message,
        selected_payment_method: flowData.selected_payment_method,
        phone_number: flowData.phone_number,
        email_address: flowData.email_address,
        flow_token: flowData.phone_number
      };

      // Add billDetails if not empty
      if (Object.values(billDetails).some(val => val != null)) {
        request.input('BillDetails', sql.NVarChar(sql.MAX), JSON.stringify(billDetails));
        columns.push('BillDetails');
        values.push('@BillDetails');
      }

      // Construct the dynamic SQL query
      const query_string = `
        INSERT INTO BillsTransactions (${columns.join(', ')})
        VALUES (${values.join(', ')});
        
        SELECT SCOPE_IDENTITY() AS TransactionID;
      `;

      // Execute the insert and return the inserted TransactionID
      const result = await request.query(query_string);

      return result.recordset[0].TransactionID;
    } catch (err) {
      console.error('Error inserting transaction:', err);
      throw err;
    }
  }

  // Comprehensive method to handle full bill and transaction insertion
  async processBillPayment(flowData, userId, message_id, from_contact) {
    try {
      // Start a transaction
      await this.connect();
      const transaction = new sql.Transaction();
      await transaction.begin();

      try {

        // Insert transaction
        const transactionId = await this.insertTransaction(flowData, userId, message_id, from_contact);

        // Commit the transaction
        await transaction.commit();

        return {
          transactionId
        };
      } catch (err) {
        // Rollback the transaction in case of any error
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      console.error('Error saving bill payment to db:', err);
      throw err;
    }
  }

  async generateReceiptMessage(transactionId) {
    try {
      await this.connect();
      const request = new sql.Request();
      request.input('TransactionID', sql.UniqueIdentifier, transactionId);
      
      // Comprehensive query to fetch all relevant transaction details
      const query = `
        SELECT 
          t.TransactionID,
          t.FlowToken,
          t.Amount,
          t.TransactionStatus,
          t.TransactionInitiationTimestamp as CreatedAt,
          t.AdditionalDetails,
          bt.BillTypeName,
          pm.MethodName as PaymehtMethodName,
          c.FullName,
          c.Email,
          c.PhoneNumber
        FROM 
          Transactions t
          LEFT JOIN BillTypes bt ON t.BillTypeID = bt.BillTypeID
          LEFT JOIN PaymentMethods pm ON t.PaymentMethodID = pm.PaymentMethodID
          LEFT JOIN Users c ON t.UserID = c.UserID
        WHERE 
          t.TransactionID = @TransactionID
      `;
      
      const result = await request.query(query);
      
      // If no transaction found
      if (result.recordset.length === 0) {
        return {
          success: false,
          message: `No transaction found with ID ${transactionId}`,
          error: true
        };
      }
      
      const transaction = result.recordset[0];
      
      // Parse additional details
      let additionalDetails = {};
      try {
        additionalDetails = JSON.parse(transaction.AdditionalDetails || '{}');
      } catch (parseError) {
        console.warn('Error parsing additional details:', parseError);
      }
      
      // Prepare receipt data object
      const receiptData = {
        success: true,
        error: false,
        transactionDetails: {
          transactionId: transaction.TransactionID,
          flowToken: transaction.FlowToken,
          amount: transaction.Amount,
          status: transaction.TransactionStatus,
          date: transaction.CreatedAt || new Date(),
          
          serviceType: transaction.BillTypeName || 'Unknown Service',
          paymentMethod: transaction.PaymentMethodName || 'Unknown Method'
        },
        customerDetails: {
          name: transaction.CustomerName || 
                additionalDetails.customerName || 
                'Customer',
          email: transaction.CustomerEmail || 
                 additionalDetails.emailAddress || 
                 'Not Provided',
          phone: transaction.CustomerPhone || 
                 additionalDetails.mobileNumber || 
                 'Not Provided'
        },
        additionalInfo: {
          serviceMessage: additionalDetails.serviceMessage || 'No additional details',
          rawAdditionalDetails: additionalDetails
        },
        
        // Generate a formatted receipt message
        receiptMessage: `
  🧾 PAYMENT RECEIPT 🧾
  Transaction ID: ${transaction.TransactionID}
  Flow Token: ${transaction.FlowToken}
  
  Service Details:
  - Type: ${transaction.BillTypeName || 'Unknown Service'}
  - Payment Method: ${transaction.PaymentMethodName || 'Unknown Method'}
  
  Payment Information:
  - Amount Paid: UGX ${transaction.Amount.toLocaleString()}
  - Status: ${transaction.TransactionStatus}
  
  Customer Information:
  - Name: ${transaction.CustomerName || 'Not Provided'}
  - Contact: ${transaction.CustomerPhone || 'Not Provided'}
  - Email: ${transaction.CustomerEmail || 'Not Provided'}
  
  Transaction Date: ${transaction.CreatedAt ? transaction.CreatedAt.toLocaleString() : 'Date Unavailable'}
  
  Thank you for your payment! 🙏
        `.trim()
      };
      
      return receiptData;
    } catch (err) {
      console.error('Error generating receipt message:', err);
      return {
        success: false,
        error: true,
        message: err.message || 'An unexpected error occurred',
        details: err
      };
    }
  }

  async generateReceiptMessages(transactionId) {
    try {
      await this.connect();

      const request = new sql.Request();
      request.input('TransactionID', sql.UniqueIdentifier, transactionId);

      // Comprehensive query to fetch all relevant transaction details
      const query = `
        SELECT 
          t.TransactionID,
          t.FlowToken,
          t.Amount,
          t.TransactionStatus,
          t.TransactionInitiationTimestamp as CreatedAt,
          t.AdditionalDetails,
          bt.BillTypeName,
          pm.MethodName as PaymehtMethodName
        FROM 
          Transactions t
          LEFT JOIN BillTypes bt ON t.BillTypeID = bt.BillTypeID
          LEFT JOIN PaymentMethods pm ON t.PaymentMethodID = pm.PaymentMethodID
        WHERE 
          t.TransactionID = @TransactionID
      `;

      const result = await request.query(query);

      // If no transaction found
      if (result.recordset.length === 0) {
        throw new Error(`No transaction found with ID ${transactionId}`);
      }

      const transaction = result.recordset[0];

      // Parse additional details
      let additionalDetails = {};
      try {
        additionalDetails = JSON.parse(transaction.AdditionalDetails || '{}');
      } catch (parseError) {
        console.warn('Error parsing additional details:', parseError);
      }

      // Format receipt message
      const receiptMessage = `
  🧾 PAYMENT RECEIPT 🧾
  
  Transaction ID: ${transaction.TransactionID}
  Flow Token: ${transaction.FlowToken}
  
  Details:
  - Type of Service: ${transaction.BillTypeName || 'Unknown Service'}
  - Payment Method: ${transaction.PaymentMethodName || 'Unknown Method'}
  - Amount Paid: UGX ${transaction.Amount.toLocaleString()}
  - Status: ${transaction.TransactionStatus}
  
  Additional Information:
  - Mobile Number: ${additionalDetails.mobileNumber || 'Not Provided'}
  - Email: ${additionalDetails.emailAddress || 'Not Provided'}
  - Service Message: ${additionalDetails.serviceMessage || 'No additional message'}
  
  Transaction Date: ${transaction.CreatedAt ? transaction.CreatedAt.toLocaleString() : 'Date Unavailable'}
  
  Thank you for your payment! 🙏
      `.trim();

      return {message: receiptMessage, status: true};
    } catch (err) {
      console.error('Error generating receipt message:', err);
      throw err;
    }
  }

  // Close connection pool
  async close() {
    try {
      if (this.pool) {
        await sql.close();
        this.pool = null;
        console.log('Database connection pool closed');
      }
    } catch (err) {
      console.error('Error closing database connection:', err);
    }
  }
}

// Create a singleton instance of the Database class
const database = new Database();

// Handle application termination
process.on('SIGINT', async () => {
  await database.close();
  process.exit(0);
});

export default database;
