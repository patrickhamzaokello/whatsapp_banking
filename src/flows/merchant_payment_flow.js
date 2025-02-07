import { MerchantFlowValidator } from "../validators/merchantPay.js";

const SCREEN_RESPONSES = {
  WELCOME: {
    screen: "WELCOME",
    data: {
    }
  },

  MERCHANT_DETAILS: {
    screen: "MERCHANT_DETAILS",
    data: {
      merchant_code: "code",
      payment_amount: "amount",
      payment_phone_number: "phone number",
      valid_details: false,
      m_error: false,
      merchant_payment_details: "Merchant details"
    },
  },
};

export const getPayMerchantNextScreen = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;
  // handle health check request
  if (action === "ping") {
    return {
      data: {
        status: "active",
      },
    };
  }

  // handle error notification
  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      data: {
        acknowledged: true,
      },
    };
  }

  // handle initial request when opening the flow and display SELECT_SERVICE screen
  if (action === "INIT") {
    return {
      ...SCREEN_RESPONSES.ACCOUNT,
    };
  }

  if (action === "data_exchange") {
    // handle the request based on the current screen
    switch (screen) {
      // handles when user interacts with SELECT_SERVICE screen
      case "WELCOME":
        // Handles user clicking on Continue to navigate to next screen
        if (data.merchant_code != null && data.payment_amount != null && data.payment_phone_number != null) {
          // fetch merchant details
          const validator = new MerchantFlowValidator();
          const { service_message, status } = await validator.fetchMerchantDetails(data.merchant_code);
          return {
            ...SCREEN_RESPONSES.MERCHANT_DETAILS,
            data: {
              merchant_code: data.merchant_code,
              payment_amount: data.payment_amount,
              payment_phone_number: data.payment_phone_number,
              valid_details: status == "valid",
              m_error: status != "valid",
              merchant_payment_details: `${merchant_details} \n\nMerchant code: ${data.merchant_code} \nAmount: ${data.payment_amount}\nPhone no: ${data.payment_phone_number}`
            },
          };
        }
        return {
          ...SCREEN_RESPONSES.WELCOME,
        };

      default:
        break;
    }
  }

  // console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};