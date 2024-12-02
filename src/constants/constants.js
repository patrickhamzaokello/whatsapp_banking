// Bill Types
const BillTypes = {
    URA_TAX: 'pay_ura',
    TV_BILL: 'pay_tv',
    NWSC_WATER: 'pay_nwsc',
    UMEME_ELECTRICITY: 'pay_umeme',
    BANK_SERVICE: 'bank_service'
};

// Payment Methods
const PaymentMethods = {
    MOBILE_MONEY: 'mobile',
    GTPAY: 'account',
};

// Transaction Statuses
const TransactionStatus = {
    PENDING: 'Pending',
    SUCCESSFUL: 'Successful',
    FAILED: 'Failed'
};

// Message Directions
const MessageDirection = {
    INCOMING: 'I',
    OUTGOING: 'O'
};

// Message Platforms
const MessagePlatforms = {
    WHATSAPP: 'WhatsApp',
    SMS: 'SMS',
    EMAIL: 'Email',
    WEB: 'Web'
};

// Detailed Bill Type Configurations
const BillTypeConfigurations = {
    [BillTypes.URA_TAX]: {
        name: 'URA Tax',
        requiredFields: ['PRNNumber', 'PRNAmount']
    },
    [BillTypes.TV_BILL]: {
        name: 'TV Bill',
        requiredFields: ['TVSerialNumber', 'TVAmount']
    },
    [BillTypes.NWSC_WATER]: {
        name: 'NWSC Water Bill',
        requiredFields: ['WaterMeterNumber', 'WaterMeterArea', 'WaterBillAmount']
    },
    [BillTypes.UMEME_ELECTRICITY]: {
        name: 'UMEME Electricity Bill',
        requiredFields: ['UMEMEMeterNumber', 'UMEMEMeterType', 'UMEMEBillAmount']
    }
};

// Validation Regex Patterns
const ValidationPatterns = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PHONE_NUMBER: /^\+?[1-9]\d{1,14}$/,
    PRN_NUMBER: /^[A-Z0-9]{10,20}$/,
    METER_NUMBER: /^[A-Z0-9]{8,12}$/
};

// System Configuration Constants
const SystemConfig = {
    MAX_RETRY_ATTEMPTS: 3,
    DEFAULT_TIMEOUT_MS: 30000,
    MAX_FILE_UPLOAD_SIZE_MB: 10,
    ENCRYPTION_SALT_ROUNDS: 10
};

// Error Codes
const ErrorCodes = {
    VALIDATION_ERROR: 'E001',
    AUTHENTICATION_ERROR: 'E002',
    DATABASE_ERROR: 'E003',
    NETWORK_ERROR: 'E004',
    PAYMENT_PROCESSING_ERROR: 'E005'
};

// Utility function to get bill type configuration
function getBillTypeConfiguration(billTypeId) {
    return BillTypeConfigurations[billTypeId] || null;
}

// Utility function to validate required fields for a bill type
function validateBillTypeFields(billTypeId, data) {
    const config = getBillTypeConfiguration(billTypeId);
    if (!config) return false;

    return config.requiredFields.every(field => 
        data[field] !== undefined && data[field] !== null && data[field] !== ''
    );
}

// Export all constants and utility functions
export {
    BillTypes,
    PaymentMethods,
    TransactionStatus,
    MessageDirection,
    MessagePlatforms,
    BillTypeConfigurations,
    ValidationPatterns,
    SystemConfig,
    ErrorCodes,
    getBillTypeConfiguration,
    validateBillTypeFields
};