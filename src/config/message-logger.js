import winston from 'winston';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

const sanitizeMessage = (message) => {
    // Replace all types of newlines with spaces and remove multiple spaces
    return message.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  };
  

// Custom format for message logs
const messageFormat = winston.format.printf(({ level, message, timestamp, type, phoneNumber }) => {
    const sanitizedMessage = sanitizeMessage(message);
    return `[${timestamp}] [${type}] [${phoneNumber}] ${sanitizedMessage}`;
});

// Create separate logger for messages
const messageLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    messageFormat
  ),
  transports: [
    // Write message logs to console with colors
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        messageFormat
      )
    }),
    // Write message logs to separate file
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'messages.log')
    })
  ]
});

// Helper functions to log messages
export const logIncomingMessage = (phoneNumber, message) => {
  messageLogger.info(message, {
    type: 'INCOMING',
    phoneNumber: `+${phoneNumber}`
  });
};

export const logOutgoingMessage = (phoneNumber, message) => {
  messageLogger.info(message, {
    type: 'OUTGOING',
    phoneNumber: `+${phoneNumber}`
  });
};

// Example usage:
// logIncomingMessage('256787250196', 'Hello');
// logOutgoingMessage('256787250196', 'Hi, how can I help you?');

export default messageLogger;