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

  async insertBillDetails(flowData) {
    try {
      await this.connect();

      const request = new sql.Request();

      // Determine bill type and prepare specific bill details
      request.input('FlowToken', sql.NVarChar(255), flowData.flow_token);
      request.input('BillTypeID', sql.Int, 1); // Hardcoded for now

      // Prepare column names and values based on bill type
      let columns = ['FlowToken', 'BillTypeID'];
      let values = ['@FlowToken', '@BillTypeID'];

      switch (flowData.s_selected_bank_service) {
        case BillTypes.URA_TAX:
          request.input('PRNNumber', sql.NVarChar(50), flowData.s_prn_number);
          request.input('PRNAmount', sql.Decimal(18, 2), flowData.s_amount);
          columns.push('PRNNumber', 'PRNAmount');
          values.push('@PRNNumber', '@PRNAmount');
          break;

        case BillTypes.TV_BILL:
          request.input('TVSerialNumber', sql.NVarChar(50), flowData.s_tv_card_no);
          request.input('TVAmount', sql.Decimal(18, 2), flowData.s_amount);
          columns.push('TVSerialNumber', 'TVAmount');
          values.push('@TVSerialNumber', '@TVAmount');
          break;

        case BillTypes.NWSC_WATER:
          request.input('WaterMeterNumber', sql.NVarChar(50), flowData.s_nwsc_meter_no);
          request.input('WaterMeterArea', sql.NVarChar(100), flowData.s_nwsc_area_selected);
          request.input('WaterBillAmount', sql.Decimal(18, 2), flowData.s_amount);
          columns.push('WaterMeterNumber', 'WaterMeterArea', 'WaterBillAmount');
          values.push('@WaterMeterNumber', '@WaterMeterArea', '@WaterBillAmount');
          break;

        case BillTypes.UMEME_ELECTRICITY:
          request.input('UMEMEMeterNumber', sql.NVarChar(50), flowData.s_umeme_meter_no);
          request.input('UMEMEMeterType', sql.NVarChar(20), flowData.s_umeme_meter_type);
          request.input('UMEMEBillAmount', sql.Decimal(18, 2), flowData.s_amount);
          columns.push('UMEMEMeterNumber', 'UMEMEMeterType', 'UMEMEBillAmount');
          values.push('@UMEMEMeterNumber', '@UMEMEMeterType', '@UMEMEBillAmount');
          break;

        default:
          throw new Error('Unsupported Bill Type');
      }

      const query_string = `
        INSERT INTO BillDetails (${columns.join(', ')})
        VALUES (${values.join(', ')});
        
        SELECT SCOPE_IDENTITY() AS BillDetailID;
      `;

      // Execute the insert and return the inserted BillDetailID
      const result = await request.query(query_string);

      return result.recordset[0].BillDetailID;
    } catch (err) {
      console.error('Error inserting bill details:', err);
      throw err;
    }
  }

  async insertTransaction(flowData, userId) {
    try {
      await this.connect();

      const request = new sql.Request();

      // Prepare columns and values arrays
      let columns = ['FlowToken', 'UserID', 'BillTypeID', 'PaymentMethodID', 'Amount', 'TransactionStatus'];
      let values = ['@FlowToken', '@UserID', '@BillTypeID', '@PaymentMethodID', '@Amount', '@TransactionStatus'];

      // Prepare transaction parameters
      request.input('FlowToken', sql.NVarChar(255), flowData.flow_token);
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('BillTypeID', sql.Int, 1); // Hardcoded for now
      request.input('PaymentMethodID', sql.Int, 1); // Hardcoded for now
      request.input('Amount', sql.Decimal(18, 2), flowData.s_amount);
      request.input('TransactionStatus', sql.NVarChar(20), 'Pending');

      // Optional additional details
      const additionalDetails = {
        mobileNumber: flowData.phone_number,
        emailAddress: flowData.email_address,
        serviceMessage: flowData.s_service_message
      };

      // Add AdditionalDetails if not empty
      if (Object.values(additionalDetails).some(val => val != null)) {
        request.input('AdditionalDetails', sql.NVarChar(sql.MAX), JSON.stringify(additionalDetails));
        columns.push('AdditionalDetails');
        values.push('@AdditionalDetails');
      }

      // Construct the dynamic SQL query
      const query_string = `
        INSERT INTO Transactions (${columns.join(', ')})
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
  async processBillPayment(flowData, userId) {
    try {
      // Start a transaction
      await this.connect();
      const transaction = new sql.Transaction();
      await transaction.begin();

      try {
        // Insert bill details
        const billDetailId = await this.insertBillDetails(flowData);

        // Insert transaction
        const transactionId = await this.insertTransaction(flowData, userId);

        // Commit the transaction
        await transaction.commit();

        return {
          billDetailId,
          transactionId
        };
      } catch (err) {
        // Rollback the transaction in case of any error
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      console.error('Error processing bill payment:', err);
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
