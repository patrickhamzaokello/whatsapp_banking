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
      paymentHistory: [],
      lastUpdated: null,
    };
    // user details tracking
    this.userDetails = {
      userEmail: null,
      phoneNumbers: new Set([phoneNumber]),
      serviceAccounts: {
        prn: [], // array of PRN objects
        tv: [], // array of tv subscription objects
        water: [], // array of water meter objects
        electricity: [] // array of electricity meter objects
      },
      lastActivity: new Date(),
      createdAt: new Date()
    };
    this.attempts = {
      tvNumber: 0,
      phoneNumber: 0,
      waterNumber: 0,
      meterNumber: 0,
      email: 0,
      paymentMethod: 0,
      prn: 0
    };
    this.createTimeout();
  }

  // Add or update email
  setEmail(email) {
    this.userDetails.userEmail = email;
    this.userDetails.lastActivity = new Date();
    return true;
  }

  // Add additional phone number
  addPhoneNumber(phoneNumber) {
    this.userDetails.phoneNumbers.add(phoneNumber);
    this.userDetails.lastActivity = new Date();
    return true;
  }

  // Add PRN details
  addPRN(prnDetails) {
    const prn = {
      number: prnDetails.number,
      amount: prnDetails.amount,
      description: prnDetails.description,
      dateAdded: new Date(),
      status: 'active',
      paymentStatus: 'pending'
    };

    this.userDetails.serviceAccounts.prn.push(prn);
    this.userDetails.lastActivity = new Date();
    return prn;
  }
  // Add TV subscription details
  addTVSubscription(tvDetails) {
    const subscription = {
      number: tvDetails.number,
      provider: tvDetails.provider, // e.g., 'DSTV' or 'GOTV'
      package: tvDetails.package,
      dateAdded: new Date(),
      status: 'active',
      lastPayment: null
    };

    this.userDetails.serviceAccounts.tv.push(subscription);
    this.userDetails.lastActivity = new Date();
    return subscription;
  }


  // Add water meter details
  addWaterMeter(waterDetails) {
    const meter = {
      number: waterDetails.number,
      area: waterDetails.area,
      dateAdded: new Date(),
      status: 'active',
      lastReading: null,
      lastPayment: null
    };

    this.userDetails.serviceAccounts.water.push(meter);
    this.userDetails.lastActivity = new Date();
    return meter;
  }

  // Add electricity meter details
  addElectricityMeter(electricityDetails) {
    const meter = {
      number: electricityDetails.number,
      type: electricityDetails.type, // e.g., 'YAKA' or 'Regular'
      dateAdded: new Date(),
      status: 'active',
      lastReading: null,
      lastPayment: null
    };

    this.userDetails.serviceAccounts.electricity.push(meter);
    this.userDetails.lastActivity = new Date();
    return meter;
  }

  // Get all service accounts for a specific type
  getServiceAccounts(type) {
    return this.userDetails.serviceAccounts[type] || [];
  }

  // Get the most recently added service account of a specific type
  getLatestServiceAccount(type) {
    const accounts = this.userDetails.serviceAccounts[type];
    return accounts.length > 0 ? accounts[accounts.length - 1] : null;
  }

  // Update service account status
  updateServiceAccountStatus(type, accountNumber, status) {
    const accounts = this.userDetails.serviceAccounts[type];
    const account = accounts.find(acc => acc.number === accountNumber);
    if (account) {
      account.status = status;
      account.lastUpdated = new Date();
      this.userDetails.lastActivity = new Date();
      return true;
    }
    return false;
  }

  // get latest prn
  getLatestPRN() {
    const prns = this.userDetails.serviceAccounts.prn;
    return prns.length > 0 ? prns[prns.length - 1] : null;
  }

  // Get session summary
  getSessionSummary() {
    return {
      phoneNumber: this.phoneNumber,
      userName: this.userName,
      userEmail: this.userDetails.userEmail,
      totalPhoneNumbers: this.userDetails.phoneNumbers.size,
      serviceAccounts: {
        prn: this.userDetails.serviceAccounts.prn.length,
        tv: this.userDetails.serviceAccounts.tv.length,
        water: this.userDetails.serviceAccounts.water.length,
        electricity: this.userDetails.serviceAccounts.electricity.length
      },
      lastActivity: this.userDetails.lastActivity,
      createdAt: this.userDetails.createdAt
    };
  }

  // Export session data
  exportSessionData() {
    return {
      userDetails: this.userDetails,
      state: this.state,
      paymentHistory: this.state.paymentHistory,
      sessionMetadata: {
        createdAt: this.userDetails.createdAt,
        lastActivity: this.userDetails.lastActivity,
        totalPayments: this.state.paymentHistory.length
      }
    };
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

  resetState() {
    this.state.currentService = null;
    this.state.flowCompletedStates = [];
    this.state.flowNextState = null;
    this.state.overallProgress = 0;
  }

  setPaymentDetails(details) {
    this.state.paymentDetails = details;
    this.userDetails.lastActivity = new Date();
  }

  getPaymentDetails() {
    return this.state.paymentDetails;
  }

  clearPaymentDetails() {
    if (this.state.paymentDetails) {
      this.state.paymentHistory.push({
        ...this.state.paymentDetails,
        clearedAt: new Date()
      });
    }
    this.state.paymentDetails = null;
    this.userDetails.lastActivity = new Date();
  }

  getPaymentHistory() {
    return this.state.paymentHistory;
  }

  generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `TXN-${timestamp}-${randomStr}`.toUpperCase();
  }


}