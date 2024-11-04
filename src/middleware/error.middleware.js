import logger from '../config/logger.js';

export const errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);

  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};