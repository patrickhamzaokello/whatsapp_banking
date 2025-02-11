import { PRN_Validator } from "../validators/prns.validator.js";

const SCREEN_RESPONSES = {
  SELECT_SERVICE: {
    screen: "SELECT_SERVICE",
  },
  SERVICE_DETAILS: {
    screen: "SERVICE_DETAILS",
    data: {
      is_prn: false,
      s_service_message: "message",
      s_can_proceed: false,
      s_error: false,
      s_service_status: "status",
      s_prn_number: "s_prn_number",
    },
  },
  PAYMENT_METHOD: {
    screen: "PAYMENT_METHOD",
    data: {},
  },
};

export const getPRNPaymentNextScreen = async (decryptedBody) => {
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
      ...SCREEN_RESPONSES.SELECT_SERVICE,
    };
  }

  if (action === "data_exchange") {
    // handle the request based on the current screen
    switch (screen) {
      // handles when user interacts with SELECT_SERVICE screen
      case "SELECT_SERVICE":
        // Handles user selecting prn, nwsc, yaka, tv selector
        if (data.s_prn_number == null) {
          return {
            ...SCREEN_RESPONSES.SELECT_SERVICE,
          };
        }

        // Handles user clicking on Continue to navigate to next screen
        if (data.s_prn_number != null) {
          //format the prn and remove extra spaces
          const formattedPRN = data.s_prn_number.replace(/\s/g, "");

          //validate prn number
          const prnChecker = new PRN_Validator();
          const { prn_message, prn_tax_payer_name, status, prn_amount } =
            await prnChecker.checkPRNStatus(formattedPRN);

          return {
            ...SCREEN_RESPONSES.SERVICE_DETAILS,
            data: {
              s_service_message: prn_message,
              tax_payer_name: prn_tax_payer_name,
              s_can_proceed: status == "available",
              s_error: status != "available",
              is_not_prn: false,
              prn_amount: prn_amount,
              s_service_status: status,
              s_prn_number: data.s_prn_number,
            },
          };
        }
        // otherwise refresh quote based on user selection
        return {
          ...SCREEN_RESPONSES.SELECT_SERVICE,
        };
      case "SERVICE_DETAILS":
        if (data.s_can_proceed) {
            return {
              ...SCREEN_RESPONSES.PAYMENT_METHOD,
              data: {
                s_can_proceed: data.s_can_proceed,
                s_prn_number: data.s_prn_number,
                is_mobile: false,
                is_account: false,
                s_amount: data.prn_amount,
                tax_payer_name: data.tax_payer_name,
                s_service_message: data.s_service_message,
                selected_payment_method: "select payment method",
              },
          }
         
        }

      case "PAYMENT_METHOD":
        // Handles user selecting mobile money or Banking selector
        if (data.payment_mode != null) {
          return {
            ...SCREEN_RESPONSES.PAYMENT_METHOD,
            data: {
              is_mobile: data.payment_mode == "mobile",
              is_account: data.payment_mode == "account",
              selected_payment_method: data.payment_mode,
            },
          };
        }

      default:
        break;
    }
  }

  // console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};
