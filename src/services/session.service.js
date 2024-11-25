import logger from '../config/logger.js';
import { Session } from '../models/Session.js'
export class SessionService {
  static sessions = new Map();

  static createSession(phoneNumber, userName) {
    const session = new Session(phoneNumber, userName);
    this.sessions.set(phoneNumber, session);
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
  }

}