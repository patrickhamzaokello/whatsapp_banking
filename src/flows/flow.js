import { PRN_Validator } from "../validators/prns.validator.js";


const SCREEN_RESPONSES = {
  SELECT_SERVICE: {
    screen: "SELECT_SERVICE",
    data: {
      is_prn: false,
      is_nwsc: false,
      is_yaka: false,
      is_tv: false,
      bank_service_type: [
        {
          id: "pay_service",
          title: "Select Service"
        },
        {
          id: "pay_prn",
          title: "Pay PRN (URA)"
        },
        {
          id: "pay_nwsc",
          title: "Pay Nwsc (Water)"
        },
        {
          id: "pay_yaka",
          title: "Pay Yaka / Umeme"
        },
        {
          id: "pay_tv",
          title: "Pay Tv subscription"
        }
      ],
      nwsc_area: [
        {
          id: "0",
          title: "Select area"
        },
        {
          id: "1",
          title: "Kampala"
        },
        {
          id: "2",
          title: "Jinja"
        },
        {
          id: "3",
          title: "Entebbe"
        },
        {
          id: "4",
          title: "Mukono"
        }
        , {
          id: "5",
          title: "Kajjansi"
        },
        {
          id: "6",
          title: "Kawuku"
        },
        {
          id: "7",
          title: "Iganga"
        },
        {
          id: "8",
          title: "Lugazi"
        },
        {
          id: "9",
          title: "Others"
        }
      ],
      umeme_meter_type: [
        {
          id: "select_umeme_meter",
          title: "Select meter type"
        },
        {
          id: "PREPAID",
          title: "Yaka"
        },
        {
          id: "POSTPAID",
          title: "Postpaid"
        },
        {
          id: "QUOTATION",
          title: "New Connection / others"
        }
      ],
      tv_providers: [
        {
          id: "0",
          title: "Select Tv provider"
        },
        {
          id: "1",
          title: "DSTV"
        },
        {
          id: "2",
          title: "GOTV"
        },
        {
          id: "3",
          title: "STAR TIMES"
        },
        {
          id: "4",
          title: "AZAM"
        }
        , {
          id: "5",
          title: "ZUKU"
        }
      ],
      selected_bank_service: "pay_service",
      selected_nwsc_area: "0",
      selected_tv_provider: "0",
      selected_umeme_meter_type: "select_umeme_meter"
    },
  },
  SERVICE_DETAILS: {
    screen: "SERVICE_DETAILS",
    data: {
      is_prn: false,
      is_nwsc: false,
      is_yaka: false,
      is_tv: false,
      s_service_message: "message",
      s_can_proceed: false,
      s_error: false,
      s_service_status: "status",
      s_selected_service_id: "service_id",
      s_selected_bank_service: "s_selected_bank_service",
      s_prn_number: "s_prn_number",
      s_nwsc_meter_no: "s_nwsc_meter_no",
      s_nwsc_area_selected: "s_nwsc_area_selected",
      s_umeme_meter_type: "s_umeme_meter_type",
      s_umeme_meter_no: "s_umeme_meter_no",
      s_tv_provider_selected: "s_tv_provider_selected",
      s_tv_card_no: "s_tv_card_no"
    }
  },
  PAYMENT_METHOD: {
    screen: "PAYMENT_METHOD",
    data: {},
  },

  SUCCESS: {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
        },
      },
    },
  },
};

export const getNextScreen = async (decryptedBody) => {
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
        if (data.bank_service_type != null) {
          return {
            ...SCREEN_RESPONSES.SELECT_SERVICE,
            data: {
              is_prn: data.bank_service_type == "pay_prn",
              is_nwsc: data.bank_service_type == "pay_nwsc",
              is_yaka: data.bank_service_type == "pay_yaka",
              is_tv: data.bank_service_type == "pay_tv",
              selected_bank_service: data.bank_service_type,
            },
          };
        }
        if (data.umeme_meter_type != null) {
          return {
            ...SCREEN_RESPONSES.SELECT_SERVICE,
            data: {
              selected_umeme_meter_type: data.umeme_meter_type
            },
          };
        }
        if (data.tv_provider_selected != null) {
          return {
            ...SCREEN_RESPONSES.SELECT_SERVICE,
            data: {
              selected_tv_provider: data.tv_provider_selected
            },
          };
        }

        if (data.nwsc_area_selected != null) {
          return {
            ...SCREEN_RESPONSES.SELECT_SERVICE,
            data: {
              selected_nwsc_area: data.nwsc_area_selected
            },
          };
        }

        // Handles user clicking on Continue to navigate to next screen
        if (data.s_selected_bank_service != null) {

          // if service is prn
          if (data.s_selected_bank_service == "pay_prn") {

            //format the prn and remove extra spaces
            const formattedPRN = data.s_prn_number.replace(/\s/g, '');

            //validate prn number
            const prnChecker = new PRN_Validator();
            const { prn_message, status, prn_amount } = await prnChecker.checkPRNStatus(formattedPRN);

            return {
              ...SCREEN_RESPONSES.SERVICE_DETAILS,
              data: {
                is_prn: data.s_selected_bank_service == "pay_prn",
                is_nwsc: data.s_selected_bank_service == "pay_nwsc",
                is_yaka: data.s_selected_bank_service == "pay_yaka",
                is_tv: data.s_selected_bank_service == "pay_tv",
                s_service_message: prn_message,
                s_can_proceed: status == "available",
                s_error: status != "available",
                is_not_prn: false,
                prn_amount: prn_amount,
                s_service_status: status,
                s_selected_service_id: data.s_selected_bank_service,
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((s) => s.id === data.s_selected_bank_service)
                  .map((s) => s.title)[0],
                s_prn_number: data.s_prn_number
              },

            };
          }
          // if service is nwsc
          if (data.s_selected_bank_service == "pay_nwsc") {
            return {
              ...SCREEN_RESPONSES.SERVICE_DETAILS,
              data: {
                is_prn: data.s_selected_bank_service == "pay_prn",
                is_nwsc: data.s_selected_bank_service == "pay_nwsc",
                is_yaka: data.s_selected_bank_service == "pay_yaka",
                is_tv: data.s_selected_bank_service == "pay_tv",
                s_service_message: "Pay National Water and Sewerage Corporation (NWSC) bill",
                s_can_proceed: true,
                s_error: false,
                is_not_prn: true,
                s_service_status: "status",
                s_selected_service_id: data.s_selected_bank_service,
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((a) => a.id === data.s_selected_bank_service)
                  .map((a) => a.title)[0],
                s_nwsc_area_selected: SCREEN_RESPONSES.SELECT_SERVICE.data.nwsc_area
                  .filter((a) => a.id === data.s_nwsc_area_selected)
                  .map((a) => a.title)[0],
                s_nwsc_meter_no: data.s_nwsc_meter_no
              },

            };
          }
          // if service is pay yaka
          if (data.s_selected_bank_service == "pay_yaka") {
            return {
              ...SCREEN_RESPONSES.SERVICE_DETAILS,
              data: {
                is_prn: data.s_selected_bank_service == "pay_prn",
                is_nwsc: data.s_selected_bank_service == "pay_nwsc",
                is_yaka: data.s_selected_bank_service == "pay_yaka",
                is_tv: data.s_selected_bank_service == "pay_tv",
                s_service_message: "Pay Umeme / Yaka Power bill",
                s_can_proceed: true,
                s_error: false,
                is_not_prn: true,
                s_service_status: "status",
                s_selected_service_id: data.s_selected_bank_service,
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((a) => a.id === data.s_selected_bank_service)
                  .map((a) => a.title)[0],
                s_umeme_meter_type: SCREEN_RESPONSES.SELECT_SERVICE.data.umeme_meter_type
                  .filter((t) => t.id === data.s_umeme_meter_type)
                  .map((t) => t.title)[0],
                s_umeme_meter_no: data.s_umeme_meter_no,
              },

            };
          }
          if (data.s_selected_bank_service == "pay_tv") {
            return {
              ...SCREEN_RESPONSES.SERVICE_DETAILS,
              data: {
                is_prn: data.s_selected_bank_service == "pay_prn",
                is_nwsc: data.s_selected_bank_service == "pay_nwsc",
                is_yaka: data.s_selected_bank_service == "pay_yaka",
                is_tv: data.s_selected_bank_service == "pay_tv",
                s_service_message: "Pay TV bill",
                s_can_proceed: true,
                s_error: false,
                is_not_prn: true,
                s_service_status: "status",
                s_selected_service_id: data.s_selected_bank_service,
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((a) => a.id === data.s_selected_bank_service)
                  .map((a) => a.title)[0],
                s_tv_provider_selected: SCREEN_RESPONSES.SELECT_SERVICE.data.tv_providers
                  .filter((t) => t.id === data.s_tv_provider_selected)
                  .map((t) => t.title)[0],
                s_tv_card_no: data.s_tv_card_no,

              },

            };
          }

        }
        // otherwise refresh quote based on user selection
        return {
          ...SCREEN_RESPONSES.SELECT_SERVICE,
        };
      case "SERVICE_DETAILS":

        if (data.s_selected_service_id != null) {
          if (data.s_selected_service_id == "pay_prn") {

            return {
              ...SCREEN_RESPONSES.PAYMENT_METHOD,
              data: {
                is_prn: data.is_prn,
                is_nwsc: data.is_nwsc,
                is_yaka: data.is_yaka,
                is_tv: data.is_tv,
                s_can_proceed: data.s_can_proceed,
                s_service_status: data.s_service_status,
                s_selected_service_id: data.s_selected_service_id,
                s_prn_number: data.s_prn_number,
                s_amount: data.prn_amount,
                is_mobile: false,
                is_account: false,
                s_selected_bank_service: data.s_selected_service_id,
                s_service_message: data.s_service_message,
                selected_payment_method: "select payment method"
              },

            };
          }
          // if service is nwsc
          if (data.s_selected_service_id == "pay_nwsc") {
            return {
              ...SCREEN_RESPONSES.PAYMENT_METHOD,
              data: {
                is_prn: data.is_prn,
                is_nwsc: data.is_nwsc,
                is_yaka: data.is_yaka,
                is_tv: data.is_tv,
                s_can_proceed: data.s_can_proceed,
                s_service_status: data.s_service_status,
                s_selected_service_id: data.s_selected_service_id,
                s_nwsc_area_selected: data.s_nwsc_area_selected,
                s_nwsc_meter_no: data.s_nwsc_meter_no,
                s_amount: data.s_amount,
                is_mobile: false,
                is_account: false,
                s_selected_bank_service: data.s_selected_service_id,
                s_service_message: data.s_service_message,
                selected_payment_method: "select payment method"
              },

            };
          }
          // if service is pay yaka
          if (data.s_selected_service_id == "pay_yaka") {
            return {
              ...SCREEN_RESPONSES.PAYMENT_METHOD,
              data: {
                is_prn: data.is_prn,
                is_nwsc: data.is_nwsc,
                is_yaka: data.is_yaka,
                is_tv: data.is_tv,
                s_can_proceed: data.s_can_proceed,
                s_service_status: data.s_service_status,
                s_selected_service_id: data.s_selected_service_id,
                s_umeme_meter_type: data.s_umeme_meter_type,
                s_umeme_meter_no: data.s_umeme_meter_no,
                s_amount: data.s_amount,
                is_mobile: false,
                is_account: false,
                s_selected_bank_service: data.s_selected_service_id,
                s_service_message: data.s_service_message,
                selected_payment_method: "select payment method"
              },

            };
          }

          if (data.s_selected_service_id == "pay_tv") {
            return {
              ...SCREEN_RESPONSES.PAYMENT_METHOD,
              data: {
                is_prn: data.is_prn,
                is_nwsc: data.is_nwsc,
                is_yaka: data.is_yaka,
                is_tv: data.is_tv,
                s_can_proceed: data.s_can_proceed,
                s_service_status: data.s_service_status,
                s_selected_service_id: data.s_selected_service_id,
                s_tv_provider_selected: data.s_tv_provider_selected,
                s_tv_card_no: data.s_tv_card_no,
                s_amount: data.s_amount,
                is_mobile: false,
                is_account: false,
                s_selected_bank_service: data.s_selected_service_id,
                s_service_message: data.s_service_message,
                selected_payment_method: "select payment method"

              },

            };
          }
        }

      case "PAYMENT_METHOD":
        // Handles user selecting UPI or Banking selector
        if (data.payment_mode != null) {
          return {
            ...SCREEN_RESPONSES.PAYMENT_METHOD,
            data: {
              is_mobile: data.payment_mode == "mobile",
              is_account: data.payment_mode == "account",
              selected_payment_method: data.payment_mode
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