export class PaymentError extends Error {
    constructor(message) {
      super(message);
      this.name = 'PaymentError';
    }
  }
  
  export class WhatsAppError extends Error {
    constructor(message) {
      super(message);
      this.name = 'WhatsAppError';
    }
  }