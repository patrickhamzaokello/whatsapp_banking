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


  // Insert data into a table
  async insertMessageLog(userId, wamid, messageContent, messageDirection, messageSource = null, platform = 'WhatsApp') {
    try {
      await this.connect();

      const request = new sql.Request();

      // Input parameters for the message log
      request.input('UserID', sql.UniqueIdentifier, userId);
      request.input('WAMID', sql.NVarChar(255), wamid);
      request.input('MessageContent', sql.NVarChar, messageContent);
      request.input('MessageDirection', sql.TinyInt, messageDirection);

      // Optional parameters with defaults
      if (messageSource) {
        request.input('MessageSource', sql.NVarChar(100), messageSource);
      }
      request.input('Platform', sql.NVarChar(50), platform);

      // Execute the insert and return the inserted MessageID
      const result = await request.query(`
            INSERT INTO MessageLog 
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
