import winston from 'winston';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs with level 'error' and below to 'error.log'
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'error.log'), 
      level: 'error' 
    }),
    // Write all logs to 'combined.log'
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'combined.log') 
    })
  ]
});

// Add error handling for production environment
if (process.env.NODE_ENV === 'production') {
  logger.exceptions.handle(
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'exceptions.log') 
    })
  );
  logger.rejections.handle(
    new winston.transports.File({ 
      filename: path.join(LOG_DIR, 'rejections.log') 
    })
  );
}

export default logger;
