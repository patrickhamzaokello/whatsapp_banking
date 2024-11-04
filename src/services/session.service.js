import logger from '../config/logger.js';
export class SessionService {
  static sessions = new Map();

  static createSession(phoneNumber, userName) {
    const session = new Session(phoneNumber, userName);
    this.sessions.set(phoneNumber, session);
    logger.info('Session created', { phoneNumber, userName });
    return session;
  }

  static getSession(phoneNumber) {
    return this.sessions.get(phoneNumber);
  }

  static removeSession(phoneNumber) {
    const session = this.sessions.get(phoneNumber);
    if (session?.timeout) {
      clearTimeout(session.timeout);
    }
    this.sessions.delete(phoneNumber);
    logger.info('Session removed', { phoneNumber });
  }
}