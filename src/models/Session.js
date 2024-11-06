import { SessionService } from '../services/session.service.js';
import { config } from '../config/environment.js';

export class Session {
  constructor(phoneNumber, userName) {
    this.phoneNumber = phoneNumber;
    this.userName = userName;
    this.state = {
      currentService: null,
      flowCompletedStates: [],
      flowNextState: null,
      overallProgress: 0,
      paymentDetails: null,
      paymentMethod: null,
      userEmail: null
    };
    this.attempts = {
      tvNumber: 0,
      phoneNumber: 0,
      waterNumber: 0,
      meterNumber: 0,
      email: 0,
      prn: 0
    };
    this.createTimeout();
  }

  createTimeout() {
    this.timeout = setTimeout(() => {
      SessionService.removeSession(this.phoneNumber);
    }, config.session.timeout);
  }

  resetTimeout() {
    clearTimeout(this.timeout);
    this.createTimeout();
  }

  setPaymentDetails(details) {
    this.state.paymentDetails = details;
  }

  resetState() {
    this.state.currentService = null;
    this.state.flowCompletedStates = [];
    this.state.flowNextState = null;
    this.state.overallProgress = 0;
  }
}