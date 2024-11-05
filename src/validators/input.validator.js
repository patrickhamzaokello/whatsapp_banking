export class InputValidator {
    static validatePhoneNumber(phoneNumber) {
      const phoneRegex = /^\d{10}$/;
      return {
        isValid: phoneRegex.test(phoneNumber),
        error: phoneRegex.test(phoneNumber) ? null : 'Invalid phone number format'
      };
    }
  
    static validateEmail(email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return {
        isValid: emailRegex.test(email),
        error: emailRegex.test(email) ? null : 'Invalid email format'
      };
    }

    static replaceSpacesWithHyphens(input){
      return input.replace(/ /g, "-");
    }
  }