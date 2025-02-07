import sql from 'mssql';
import { config } from './environment.js';
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



  async determineUserMessageState(userID) {
    try {
      await this.connect(); // Ensure a valid connection
      const request = new sql.Request();
      request.input('UserID', sql.UniqueIdentifier, userID);

      const query = `SELECT handoff_to_human FROM Users WHERE UserID = @UserID`;
      const result = await request.query(query);

      return result.recordset.length > 0 ? Boolean(result.recordset[0].handoff_to_human) : false;

    } catch (error) {
      console.error('Error determining user state:', error);
      throw error;
    }
  }

  async updateUserChatState(userID, handover_to_human_state) {
    try {
      if (handover_to_human_state === true) {
        handover_to_human_state = 1;
      } else {
        handover_to_human_state = 0;
      }
      await this.connect(); // Ensure a valid connection
      const request = new sql.Request();
      request.input('UserID', sql.UniqueIdentifier, userID);
      request.input('handoff_to_human', sql.Bit, handover_to_human_state);

      const query = `UPDATE Users SET handoff_to_human = @handoff_to_human WHERE UserID = @UserID`;
      const result = await request.query(query);

      return result.rowsAffected[0] > 0;

    } catch (error) {
      console.error('Error updating user chat state:', error);
      throw error;
    }
  }

  async getOrCreateUser(phoneNumber, fullName = null) {
    try {
      await this.connect(); // Ensure connection is established properly

      if (!phoneNumber) {
        console.error('Invalid phone number:', phoneNumber);
        throw new Error('Invalid phone number format');
      }

      if (typeof phoneNumber !== 'string') {
        phoneNumber = phoneNumber.toString();
      }

      const request = new sql.Request(this.pool); // Ensure request is tied to an active pool
      request.input('PhoneNumber', sql.VarChar(15), phoneNumber);
      request.input('FullName', sql.NVarChar(100), fullName || ''); // Ensure FullName is never null
      request.output('UserID', sql.UniqueIdentifier);

      const result = await request.execute('GetOrCreateUser');

      return result.output.UserID || request.parameters.UserID.value;
    } catch (err) {
      console.error('Error executing GetOrCreateUser:', err);
      throw err;
    }
  }

  // create flow form 
  async insertFlowForm(userId, flow_token, flow_type) {
    try {
      await this.connect();

      const request = new sql.Request();
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('FlowToken', sql.NVarChar(255), flow_token);
      request.input('FlowName', sql.NVarChar(25), flow_type);
      // Execute the insert and return the inserted FlowFormID
      const result = await request.query(`
            INSERT INTO FlowForms
            (UserID, FlowToken,FlowName)
            VALUES
            (@UserID, @FlowToken, @FlowName);
            SELECT SCOPE_IDENTITY() AS ID;
        `);

      // Return the inserted FlowFormID
      return result.recordset[0].ID;
    } catch (err) {
      console.error('Error executing insertFlowForm:', err);
      throw err;
    }
  }



  async insertOrUpdateUserLocation(userPhone, latitude, longitude, fileUrl) {
    try {
      await this.connect();

      const request = new sql.Request();

      // Input parameters
      request.input('PhoneNumber', sql.VarChar(100), userPhone);
      request.input('Latitude', sql.NVarChar(100), latitude);
      request.input('Longitude', sql.NVarChar(100), longitude);
      request.input('HtmlFileLink', sql.NVarChar(200), fileUrl);

      // Check if the phone number already exists
      const query = `
        IF EXISTS (SELECT 1 FROM UserLocation WHERE PhoneNumber = @PhoneNumber)
        BEGIN
            UPDATE UserLocation
            SET Latitude = @Latitude,
                Longitude = @Longitude,
                HtmlFileLink = @HtmlFileLink,
                DateUpdated = GETDATE(),
                Processed = 1
            WHERE PhoneNumber = @PhoneNumber;

            SELECT 'Updated' AS Status;
        END
        ELSE
        BEGIN
            INSERT INTO UserLocation 
            (PhoneNumber, Latitude, Longitude, HtmlFileLink, Processed)
            VALUES 
            (@PhoneNumber, @Latitude, @Longitude, @HtmlFileLink, 1);

            SELECT 'Inserted' AS Status;
        END
    `;

      // Execute the query
      const result = await request.query(query);

      // Return the status of the operation
      return { status: result.recordset[0].Status };
    } catch (err) {
      console.error('Error inserting or updating user location:', err);
      throw err;
    }
  }


  // clinet


  // Insert data into a table
  async insertMessageLog(userId, wamid, messageContent, messageDirection, messageSource = null, platform = 'WhatsApp') {
    try {
      await this.connect();

      const request = new sql.Request();

      // Input parameters for the message log
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('WAMID', sql.NVarChar(255), wamid);
      request.input('MessageContent', sql.NVarChar, messageContent);
      request.input('MessageDirection', sql.NVarChar(20), messageDirection);

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

      // Get the MessageID of the inserted message
      const messageId = result.recordset[0].MessageID;

      // Return the MessageID of the inserted message
      return messageId;
    } catch (err) {
      console.error('Error inserting message log:', err);
      throw err;
    }
  }


  async updateTransactionStatus(transactionId, status) {
    try {
      // Ensure the database connection is established
      await this.connect();

      const request = new sql.Request();

      // Prepare the parameters
      request.input('TransactionID', sql.UniqueIdentifier, transactionId);
      request.input('TransactionStatus', sql.NVarChar(20), status);
      request.input('TransactionUpdateTimestamp', sql.DateTime, new Date());

      // Construct the update SQL query
      const query = `
        UPDATE BillsTransactions
        SET TransactionStatus = @TransactionStatus,
            TransactionUpdateTimestamp = @TransactionUpdateTimestamp
        WHERE TransactionID = @TransactionID;
      `;

      // Execute the update query
      const result = await request.query(query);

      // Return a success message or a flag indicating the number of affected rows
      if (result.rowsAffected[0] > 0) {
        console.log(`Transaction ${transactionId} updated successfully.`);
        return { success: true, message: `Transaction ${transactionId} updated successfully.` };
      } else {
        console.log(`Transaction ${transactionId} not found.`);
        return { success: false, message: `Transaction ${transactionId} not found.` };
      }
    } catch (err) {
      console.error('Error updating transaction status:', err);
      throw err;
    }
  }


  async insertBillDetails(TXN_ID, Bill_Type, TXNBill_DETAILS, TXNBill_Amount) {
    try {
      await this.connect();

      const request = new sql.Request();

      const parsed_service_message = await this.parseBillDetails(TXNBill_DETAILS);

      const { messsage_data } = await this.extractMessageDetails(parsed_service_message.s_service_message, Bill_Type);

      const {
        prnNumber,
        taxpayerName,
        accountNumber,
        customerName,
        customerArea,
        tvProvider,
        tvAccountNumber,
        tvCustomerName,
        meterNumber,
        yakaCustomerName,
        meterType
      } = messsage_data;

      switch (Bill_Type) {
        case 'PRN':
          await request
            .input('transactionId', sql.UniqueIdentifier, TXN_ID)
            .input('prnNumber', sql.NVarChar(50), prnNumber)
            .input('amount', sql.NVarChar(50), TXNBill_Amount)
            .input('taxpayerName', sql.NVarChar(255), taxpayerName)
            .query(`
              INSERT INTO URAPAYMENTS (TransactionID, PRNNumber, Amount, TaxpayerName)
              VALUES (@transactionId, @prnNumber, @amount, @taxpayerName)
            `);
          break;

        case 'NWSC':
          await request
            .input('transactionId', sql.UniqueIdentifier, TXN_ID)
            .input('meterNumber', sql.NVarChar(50), accountNumber)
            .input('area', sql.NVarChar(50), customerArea)
            .input('amount', sql.NVarChar(50), TXNBill_Amount)
            .input('customerName', sql.NVarChar(255), customerName)
            .query(`
              INSERT INTO NWSCPAYMENTS (TransactionID, MeterNumber, Area, Amount, CustomerName)
              VALUES (@transactionId, @meterNumber, @area, @amount, @customerName)
            `);
          break;

        case 'TV':
          await request
            .input('transactionId', sql.UniqueIdentifier, TXN_ID)
            .input('tvNumber', sql.NVarChar(50), tvAccountNumber)
            .input('tvProvider', sql.NVarChar(50), tvProvider)
            .input('amount', sql.NVarChar(50), TXNBill_Amount)
            .input('customerName', sql.NVarChar(255), tvCustomerName)
            .query(`
              INSERT INTO TVPAYMENTS (TransactionID, TvNumber, TVProvider, Amount, CustomerName)
              VALUES (@transactionId, @tvNumber, @tvProvider, @amount, @customerName)
            `);
          break;

        case 'UMEME':
          await request
            .input('transactionId', sql.UniqueIdentifier, TXN_ID)
            .input('meterNumber', sql.NVarChar(50), meterNumber)
            .input('meterType', sql.NVarChar(50), meterType)
            .input('amount', sql.NVarChar(50), TXNBill_Amount)
            .input('customerName', sql.NVarChar(255), yakaCustomerName)
            .query(`
              INSERT INTO UMEMEPAYMENTS (TransactionID, MeterNumber, MeterType, Amount, CustomerName)
              VALUES (@transactionId, @meterNumber, @meterType, @amount, @customerName)
            `);
          break;

        default:
          console.error('Bill type does not match');
      }
    } catch (err) {
      console.error('Error inserting bill details:', err);
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

      const billTypes = {
        is_prn: 'PRN',
        is_nwsc: 'NWSC',
        is_tv: 'TV',
        is_yaka: 'UMEME'
      };

      const paymentMethods = {
        is_mobile: 'Mobile Money',
        is_account: 'GTPay',
      };

      // Find the first true boolean and assign the corresponding string
      const billType = Object.keys(billTypes).find(key => flowData[key]) ? billTypes[Object.keys(billTypes).find(key => flowData[key])] : 'Unknown';
      const paymentMethod = Object.keys(paymentMethods).find(key => flowData[key]) ? paymentMethods[Object.keys(paymentMethods).find(key => flowData[key])] : 'Unknown';

      // Prepare transaction parameters
      request.input('FlowToken', sql.NVarChar(255), flowData.flow_token);
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('BillType', sql.NVarChar(20), billType);
      request.input('PaymentMethod', sql.NVarChar(20), paymentMethod);
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
        flow_token: flowData.flow_token
      };

      // Add billDetails if not empty
      if (Object.values(billDetails).some(val => val != null)) {
        request.input('BillDetails', sql.NVarChar(sql.MAX), JSON.stringify(billDetails));
        columns.push('BillDetails');
        values.push('@BillDetails');
      }

      // Construct the dynamic SQL query
      const query_string = `
      DECLARE @OutputTable TABLE (TransactionID UNIQUEIDENTIFIER);

      INSERT INTO BillsTransactions (${columns.join(', ')})
      OUTPUT INSERTED.TransactionID INTO @OutputTable
      VALUES (${values.join(', ')});

      SELECT TransactionID FROM @OutputTable;
    `;

      // Execute the insert and return the inserted TransactionID
      const result = await request.query(query_string);

      return { TXN_ID: result.recordset[0].TransactionID, Bill_Type: billType, TXNBill_DETAILS: JSON.stringify(billDetails), TXNBill_Amount: flowData.s_amount };
    } catch (err) {
      console.error('Error inserting transaction:', err);
      throw err;
    }
  }

  async extractMessageDetails(message, billtype) {

    let extractedDetailsObject = {};
    let extractedDetails = message;

    switch (billtype) {
      case 'PRN':
        // Extract PRN Number and Taxpayer Name
        const prnMatch = message.match(/PRN Number:\s*(\d+)/);
        const taxpayerMatch = message.match(/Taxpayer Name:\s*(.+)/);

        const prnNumber = prnMatch ? prnMatch[1] : 'Not Available';
        const taxpayerName = taxpayerMatch ? taxpayerMatch[1].trim() : 'Not Available';

        extractedDetails = `PRN: ${prnNumber}\nTaxpayer Name: ${taxpayerName}`;
        extractedDetailsObject = {
          prnNumber: prnNumber,
          taxpayerName: taxpayerName
        };

        break;

      case 'NWSC':
        // Extract Account Number and Customer Name
        const accountMatch = message.match(/Meter Number:\s*(\d+)/);
        const customerMatch = message.match(/Customer Name:\s*(.+)/);
        const areaMatch = message.match(/Area:\s*(.+)/);

        const accountNumber = accountMatch ? accountMatch[1] : 'Not Available';
        const customerName = customerMatch ? customerMatch[1].trim() : 'Not Available';
        const customerArea = areaMatch ? areaMatch[1].trim() : 'Not Available';

        extractedDetails = `Meter No: ${accountNumber}\nCustomer: ${customerName}\nArea: ${customerArea}`;
        extractedDetailsObject = {
          accountNumber: accountNumber,
          customerName: customerName,
          customerArea: customerArea
        };
        break;

      case 'TV':
        // Extract TV Account and Account Holder
        const tvAccountMatch = message.match(/TV Account:\s*(\d+)/);
        const tvCustomerMatch = message.match(/Account Holder:\s*(.+)/);
        const providerMatch = message.match(/Provider:\s*(.+)/);

        const tvAccountNumber = tvAccountMatch ? tvAccountMatch[1] : 'Not Available';
        const tvCustomerName = tvCustomerMatch ? tvCustomerMatch[1].trim() : 'Not Available';
        const tvProvider = providerMatch ? providerMatch[1].trim() : 'Not Available';

        extractedDetails = `TV Provider: ${tvProvider}\nTV Account: ${tvAccountNumber}\nAccount Holder: ${tvCustomerName}`;
        extractedDetailsObject = {
          tvProvider: tvProvider,
          tvAccountNumber: tvAccountNumber,
          tvCustomerName: tvCustomerName
        };
        break;

      case 'UMEME':
        // Extract Meter Number and Customer Name
        const yakaMeterMatch = message.match(/Meter Number:\s*(\d+)/);
        const yakaCustomerMatch = message.match(/Customer:\s*(.+)/);
        const meterMatch = message.match(/Type:\s*(.+)/);

        const meterNumber = yakaMeterMatch ? yakaMeterMatch[1] : 'Not Available';
        const yakaCustomerName = yakaCustomerMatch ? yakaCustomerMatch[1].trim() : 'Not Available';
        const meterType = meterMatch ? meterMatch[1].trim() : 'Not Available';
        extractedDetails = `Meter Number: ${meterNumber}\nCustomer Name: ${yakaCustomerName}\nType: ${meterType}`;
        extractedDetailsObject = {
          meterNumber: meterNumber,
          yakaCustomerName: yakaCustomerName,
          meterType: meterType
        };


        break;

      default:
        // Fallback for unsupported bill types
        extractedDetails = 'Details: Unsupported bill type';
        extractedDetailsObject = { Details: 'Unsupported bill type' };
        break;
    }

    // Return the final message
    return {
      message_raw: extractedDetails,
      messsage_data: extractedDetailsObject
    };
  }

  async getFlowTokenDetailsbyToken(flowToken) {
    try {
      await this.connect();

      const request = new sql.Request();

      // Set the input parameter for the query
      request.input('FlowToken', sql.NVarChar(255), flowToken);

      // Define the query to fetch the required details
      const query = `
        SELECT 
          FlowToken, 
          UserID, 
          FlowName
        FROM FlowForms
        WHERE FlowToken = @FlowToken;
      `;

      // Execute the query
      const result = await request.query(query);

      // Check if a record is found
      if (result.recordset.length === 0) {
        throw new Error(`No record found for FlowToken: ${flowToken}`);
      }

      // Extract and return the details
      const { FlowToken, UserID, FlowName } = result.recordset[0];
      return { FlowToken, UserID, FlowName };
    } catch (err) {
      console.error('Error fetching flow token details:', err);
      throw err;
    }
  }

  async getUsersWithLastChatMessage() {
    // Execute this procedure to get results 
    // EXEC GetChatListWithParams @PageSize = 100, @PageNumber = 1
    try {
      await this.connect();
      const request = new sql.Request();
      // Define the query to fetch the required details
      const query = `
        EXEC GetChatListWithParams 
        @PageSize = 100, 
        @PageNumber = 1
      `;
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching users with last chat message:', error);
      throw error;
    } finally {
      await this.close();
    }

  }

  async GetUserMessagesWithDateRange(UserID) {
    // Execute this procedure to get results 
    // EXEC GetUserMessagesWithDateRange
    // @UserID = 'A2F1E084-581E-4098-A745-3B36873B8F6A',
    // @StartDate = '2023-01-01',
    // @EndDate = '2024-12-31',
    // @PageSize = 20,
    // @PageNumber = 1
    try {
      await this.connect();
      const request = new sql.Request();
      // Define the query to fetch the required details
      request.input('UserID', sql.UniqueIdentifier, UserID);
      const query = `
        EXEC GetUserMessagesWithDateRange 
        @UserID = @UserID, 
        @PageSize = 100,
        @PageNumber = 1
      `;
      const result = await request.query(query);
      return result.recordset;
    } catch (error) {
      console.error('Error fetching user messages with date range:', error);
      throw error;
    } finally {
      await this.close();
    }
  }

  async getAccountRequestDetailsByAccountID(account_id) {
    try {
      await this.connect();
      const request = new sql.Request();

      request.input('AccountID', sql.UniqueIdentifier, account_id);

      // Define the query to fetch the required details
      const query = `
        SELECT AccountID
              ,UserID
              ,AccountForm
              ,IsPosted
              ,DateCreated
              ,MessageFrom
              ,IsProcessed
              ,ImageSignatureURL
              ,ImageNationalID1URL
              ,ImageNationalID2URL
              ,ImageSelfieURL
          FROM AccountForms
           WHERE AccountID = @AccountID;
      `;

      // Execute the query
      const result = await request.query(query);

      // Check if a record is found
      if (result.recordset.length === 0) {
        throw new Error('No account requests found');
      }

      const record = result.recordset[0];
      const accountFormDetails = JSON.parse(record.AccountForm);
      return {
        AccountID: record.AccountID ?? '',
        UserID: record.UserID ?? '',
        DateCreated: this.formatDateTime(record.DateCreated ?? ''),
        MessageFrom: record.MessageFrom ?? '',
        IsProcessed: record.IsProcessed ?? '',
        IsPosted: record.IsPosted ?? '',

        user_title: accountFormDetails.user_title ?? '',
        fullname: (accountFormDetails.firstname ?? '') + ' ' + (accountFormDetails.middlename ?? '') + ' ' + (accountFormDetails.lastname ?? ''),
        gender: accountFormDetails.gender ?? '',
        marital_status: accountFormDetails.marital_status ?? '',
        date_of_birth: this.formatDate(accountFormDetails.date_of_birth) ?? '',
        main_phone_number: accountFormDetails.main_phone_number ?? '',
        email_address: accountFormDetails.email_address ?? '',
        location: accountFormDetails.location ?? '',
        s_account_currency: accountFormDetails.s_account_currency ?? '',
        s_account_type: accountFormDetails.s_account_type ?? '',
        national_id_card_number: accountFormDetails.national_id_card_number ?? '',
        national_id_nin: accountFormDetails.national_id_nin ?? '',
        kin_fullname: (accountFormDetails.kin_firstname ?? '') + ' ' + (accountFormDetails.kin_othername ?? '') + ' ' + (accountFormDetails.kin_lastname ?? ''),
        kin_relationship: accountFormDetails.kin_relationship ?? '',
        kin_phone_number: accountFormDetails.kin_phone_number ?? '',
        kin_email_address: accountFormDetails.kin_email_address ?? '',
        dp_institution_name: accountFormDetails.dp_institution_name ?? '',
        dp_account_name: accountFormDetails.dp_account_name ?? '',
        dp_account_mobile_no: accountFormDetails.dp_account_mobile_no ?? '',
        dp_mode_of_payment: accountFormDetails.dp_mode_of_payment ?? '',
        key_fact_agreement: accountFormDetails.key_fact_agreement ?? '',
        collection_agreement: accountFormDetails.collection_agreement ?? '',
        personal_data_agreement: accountFormDetails.personal_data_agreement ?? '',
        signature_image: [{ signature_file_name: 'https://socialbanking.gtbank.co.ug/' + (record.ImageSignatureURL ?? '') }],
        national_id_images: [
          { file_name: 'https://socialbanking.gtbank.co.ug/' + (record.ImageNationalID1URL ?? '') },
          { file_name: 'https://socialbanking.gtbank.co.ug/' + (record.ImageNationalID2URL ?? '') },
        ],
        profileImage: [{ selfie_file_name: 'https://socialbanking.gtbank.co.ug/' + (record.ImageSelfieURL ?? '') }],
      };

    } catch (err) {
      console.error('Error fetching account requests:', err);
      throw err;
    }
  }

  async getAllAccountsRequest() {
    try {
      await this.connect();
      const request = new sql.Request();

      // Define the query to fetch the required details
      const query = `
        SELECT AccountID
              ,UserID
              ,AccountForm
              ,IsPosted
              ,DateCreated
              ,MessageFrom
              ,IsProcessed
              ,ImageSignatureURL
              ,ImageNationalID1URL
              ,ImageNationalID2URL
              ,ImageSelfieURL
          FROM AccountForms
          ORDER BY DateCreated DESC
      `;

      // Execute the query
      const result = await request.query(query);

      // Check if a record is found
      if (result.recordset.length === 0) {
        throw new Error('No account requests found');
      }

      const detailedResults = result.recordset.map(record => {
        const accountFormDetails = JSON.parse(record.AccountForm);
        return {
          AccountID: record.AccountID,
          UserID: record.UserID,
          DateCreated: this.formatDateTime(record.DateCreated),
          MessageFrom: record.MessageFrom,
          IsProcessed: record.IsProcessed,
          IsPosted: record.IsPosted,
          ImageSignatureURL: record.ImageSignatureURL,
          ImageNationalID1URL: record.ImageNationalID1URL,
          ImageNationalID2URL: record.ImageNationalID2URL,
          ImageSelfieURL: record.ImageSelfieURL,
          fullName: (accountFormDetails.firstname ?? '') + ' ' + (accountFormDetails.middlename ?? '') + ' ' + (accountFormDetails.lastname ?? ''),
          email: accountFormDetails.email_address,
          phoneNumber: accountFormDetails.main_phone_number,
          dateOfBirth: this.formatDate(accountFormDetails.date_of_birth),
          gender: accountFormDetails.gender,
          address: accountFormDetails.location,
        };
      });


      // Return the detailed result set as JSON
      return detailedResults;
    } catch (err) {
      console.error('Error fetching account requests:', err);
      throw err;
    }
  }

  formatDateTime(dateString) {
    const date = new Date(dateString);
    const formattedDate = date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).replace(',', '').replace(' at', '');
    return formattedDate;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const formattedDate = date.toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).replace(',', '');
    return formattedDate;
  }



  async saveCustomerSupportFlowData(flowData, userId, message_id, from_contact) {
    try {
      // Establish connection to the database
      await this.connect();

      const request = new sql.Request();

      const support_type = flowData.support_type;

      let support_subject = '';
      let support_body = '';

      if (support_type === 'make_inquiry') {
        support_subject = flowData.inquire_subject;
        support_body = flowData.inquiry_body;
      } else if (support_type === 'report_complaint') {
        support_subject = flowData.complaint_subject;
        support_body = flowData.complaint_body;
      }


      // Prepare parameters
      request.input('flowToken', sql.NVarChar(255), flowData.flow_token);
      request.input('userID', sql.UniqueIdentifier, userId);
      request.input('supportForm', sql.NVarChar(sql.MAX), JSON.stringify(flowData));
      request.input('messageID', sql.NVarChar(255), message_id);
      request.input('messageFrom', sql.NVarChar(20), from_contact);
      request.input('support_type', sql.VarChar(40), support_type);
      request.input('support_subject', sql.NVarChar(120), support_subject);
      request.input('support_body', sql.NVarChar(sql.MAX), support_body);

      // Build the SQL query
      const query = `
      DECLARE @OutputTable TABLE (supportID UNIQUEIDENTIFIER);

      INSERT INTO CustomerSupport (
          flowToken, userID, supportForm, messageID, messageFrom, support_type,
          support_subject, support_body
      )
      OUTPUT INSERTED.supportID INTO @OutputTable
      VALUES (
          @flowToken, @userID, @supportForm, @messageID, @messageFrom, @support_type,
          @support_subject, @support_body
      );

      SELECT supportID FROM @OutputTable;
  `;

      // Execute the query
      const result = await request.query(query);

      // Return the inserted supportID
      return {
        supportID: result.recordset[0].supportID,
        FlowToken: flowData.flow_token,
        MessageID: message_id,
      };

    } catch (error) {
      console.error('Error saving customer support details:', error);
      throw error;
    }
  }


  async saveAccountOpeningFlowData(flowData, userId, message_id, from_contact) {
    try {
      // Establish connection to the database
      await this.connect();

      const request = new sql.Request();

      // Insert default values for optional columns if not provided in `flowData`
      const isPosted = flowData.IsPosted || 0;
      const imagesDownloaded = flowData.ImagesDownloaded || 0;
      const isNationalIDProcessed = flowData.IsNationalIDProcessed || 0;
      const userLocation = flowData.UserLocation || null;
      const middleWareResponse = flowData.MiddleWareResponse || null;

      // Prepare parameters
      request.input('FlowToken', sql.NVarChar(255), flowData.flow_token);
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('AccountForm', sql.NVarChar(sql.MAX), JSON.stringify(flowData));
      request.input('UserLocation', sql.UniqueIdentifier, userLocation);
      request.input('IsPosted', sql.Int, isPosted);
      request.input('ImagesDownloaded', sql.Int, imagesDownloaded);
      request.input('IsNationalIDProcessed', sql.Int, isNationalIDProcessed);
      request.input('MessageID', sql.NVarChar(255), message_id);
      request.input('MessageFrom', sql.NVarChar(20), from_contact);
      request.input('MiddleWareResponse', sql.NVarChar(sql.MAX), middleWareResponse);

      // Build the SQL query
      const query = `
            DECLARE @OutputTable TABLE (AccountID UNIQUEIDENTIFIER);

            INSERT INTO AccountForms (
                FlowToken, UserID, AccountForm, UserLocation, IsPosted, ImagesDownloaded,
                IsNationalIDProcessed, MessageID, MessageFrom, MiddleWareResponse
            )
            OUTPUT INSERTED.AccountID INTO @OutputTable
            VALUES (
                @FlowToken, @UserID, @AccountForm, @UserLocation, @IsPosted, @ImagesDownloaded,
                @IsNationalIDProcessed, @MessageID, @MessageFrom, @MiddleWareResponse
            );

            SELECT AccountID FROM @OutputTable;
        `;

      // Execute the query
      const result = await request.query(query);

      // Return the inserted AccountID
      return {
        AccountID: result.recordset[0].AccountID,
        FlowToken: flowData.flow_token,
        MessageID: message_id,
      };
    } catch (error) {
      console.error('Error saving account details:', error);
      throw error;
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
        const { TXN_ID, Bill_Type, TXNBill_DETAILS, TXNBill_Amount } = await this.insertTransaction(flowData, userId, message_id, from_contact);

        await this.insertBillDetails(TXN_ID, Bill_Type, TXNBill_DETAILS, TXNBill_Amount);

        // Commit the transaction
        await transaction.commit();

        return {
          TXN_ID
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
          t.BillDetails,
          t.BillType,
          t.PaymentMethod,
          c.FullName as CustomerName,
          c.Email as CustomerEmail,
          t.MessageID as form_message_id,
          t.MessageFrom as receiptent_contact,
          c.PhoneNumber as CustomerPhone
        FROM 
          BillsTransactions t
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

      // Parse additional details from BillDetails
      const parsed_service_message = await this.parseBillDetails(transaction.BillDetails);

      // Prepare receipt data object
      const { message_raw } = await this.extractMessageDetails(parsed_service_message.s_service_message, transaction.BillType);

      const receiptData = {
        success: true,
        error: false,
        receiptent_contact: transaction.receiptent_contact,
        MessageID: transaction.form_message_id,
        transactionDetails: {
          transactionId: transaction.TransactionID,
          flowToken: transaction.FlowToken,
          amount: transaction.Amount,
          status: transaction.TransactionStatus,
          date: transaction.CreatedAt || new Date(),
          serviceType: transaction.BillType || 'Unknown Service',
          paymentMethod: transaction.PaymentMethod || 'Unknown Method'
        },
        customerDetails: {
          name: transaction.CustomerName || 'Not Provided',
          // Mask email - show only the domain part
          email: await this.maskEmail(parsed_service_message.email_address || 'Not Provided'),
          // Mask phone - show only the last 4 digits
          phone: await this.maskPhone(parsed_service_message.phone_number || 'Not Provided')
        },
        additionalInfo: {
          serviceMessage: message_raw || 'No additional details',
          rawAdditionalDetails: parsed_service_message,
        },
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

  async parseBillDetails(billDetails) {
    let additionalDetails = {};
    try {
      additionalDetails = JSON.parse(billDetails || '{}');
    } catch (parseError) {
      console.warn('Error parsing additional details:', parseError);
    }
    return additionalDetails;
  }


  async maskEmail(email) {
    // Convert email to lowercase to ensure consistency
    email = email.toLowerCase();

    // Check if the email contains '@'
    if (email && email.includes('@')) {
      const [localPart, domain] = email.split('@');

      // Mask all but the first and last character of the local part
      const maskedLocalPart =
        localPart.length > 2
          ? localPart[0] + '*****' + localPart.slice(-1)
          : localPart[0] + '*****';

      return `${maskedLocalPart}@${domain}`;
    }

    // Return the original email if invalid or doesn't contain '@'
    return email;
  }

  async maskPhone(phoneNumber) {
    const phoneRegex = /^(?:256|\+256|0)?([17]\d{8}|[2-9]\d{8})$/;
    const cleanPhoneNumber = phoneNumber.replace(/[\s-]/g, '');

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
      phoneNumber = formatPhoneNumber(cleanPhoneNumber);

      // Preserve the first 2 and last 2 digits while masking the middle
      const maskedPhone =
        phoneNumber.substring(0, 4) +
        '*'.repeat(phoneNumber.length - 6) +
        phoneNumber.slice(-2);

      return maskedPhone;
    }

    // If the phone number is too short, return it unmasked
    return phoneNumber;
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
