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
      userEmail: null
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

  setPaymentDetails(paymentDetails) {
    try {
      // Validate required payment fields
      const requiredFields = ['amount', 'service', 'userName', 'email'];
      const missingFields = requiredFields.filter(field => !paymentDetails[field]);

      if (missingFields.length > 0) {
        throw new Error(`Missing required payment fields: ${missingFields.join(', ')}`);
      }

      // Format amount to 2 decimal places and ensure it's a number
      const formattedAmount = Number(paymentDetails.amount).toFixed(2);
      if (isNaN(formattedAmount)) {
        throw new Error('Invalid amount format');
      }

      // Create a standardized payment details object
      const standardizedPaymentDetails = {
        ...paymentDetails,
        amount: formattedAmount,
        transactionId: this.generateTransactionId(),
        timestamp: new Date().toISOString(),
        status: 'pending'
      };

      // Store the current payment details in history
      if (this.state.paymentDetails) {
        this.state.paymentHistory.push(this.state.paymentDetails);
      }

      // Update current payment details
      this.state.paymentDetails = standardizedPaymentDetails;
      this.state.lastUpdated = new Date().toISOString();

      return {
        success: true,
        message: 'Payment details updated successfully',
        paymentDetails: standardizedPaymentDetails
      };

    } catch (error) {
      console.error('Error setting payment details:', error);
      return {
        success: false,
        message: error.message,
        error: error
      };
    }
  }

  // Helper method to get payment details
  getPaymentDetails() {
    return this.state.paymentDetails;
  }

  // Helper method to generate unique transaction ID
  generateTransactionId() {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `TXN-${timestamp}-${randomStr}`.toUpperCase();
  }

  validatePaymentStatus() {
    if (!this.state.paymentDetails) {
      return {
        valid: false,
        message: 'No payment details found'
      };
    }

    const paymentAge = new Date() - new Date(this.state.paymentDetails.timestamp);
    const maxAge = 30 * 60 * 1000; // 30 minutes in milliseconds

    if (paymentAge > maxAge) {
      return {
        valid: false,
        message: 'Payment details have expired'
      };
    }

    return {
      valid: true,
      message: 'Payment details are valid'
    };
  }

  // Helper method to update payment status
  updatePaymentStatus(status, metadata = {}) {
    if (!this.state.paymentDetails) {
      throw new Error('No payment details found');
    }

    this.state.paymentDetails = {
      ...this.state.paymentDetails,
      status,
      lastStatusUpdate: new Date().toISOString(),
      metadata: {
        ...this.state.paymentDetails.metadata,
        ...metadata
      }
    };

    return this.state.paymentDetails;
  }

  // Helper method to clear payment details
  clearPaymentDetails() {
    // Store in history before clearing
    if (this.state.paymentDetails) {
      this.state.paymentHistory.push(this.state.paymentDetails);
    }

    this.state.paymentDetails = null;
    this.state.lastUpdated = new Date().toISOString();

    return {
      success: true,
      message: 'Payment details cleared successfully'
    };
  }

  // Helper method to get payment history
  getPaymentHistory() {
    return this.state.paymentHistory;
  }
}