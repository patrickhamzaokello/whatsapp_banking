/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// this object is generated from Flow Builder under "..." > Endpoint > Snippets > Responses
// To navigate to a screen, return the corresponding response from the endpoint. Make sure the response is encrypted.
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
    data: {
      is_mobile: false,
      is_account: false,
      emi: "\u20b9 20,000",
      tenure: "12 months",
      amount: "\u20b9 500",
    },
  },
  SUMMARY: {
    screen: "SUMMARY",
    data: {
      amount: "\u20b9 7,20,000",
      tenure: "12 months",
      rate: "9% pa",
      emi: "\u20b9 3500",
      fee: "\u20b9 500",
      payment_mode: "Transfer to account xxxx2342",
    },
  },
  COMPLETE: {
    screen: "COMPLETE",
    data: {},
  },
  SUCCESS: {
    screen: "SUCCESS",
    data: {
      extension_message_response: {
        params: {
          flow_token: "REPLACE_FLOW_TOKEN",
          some_param_name: "PASS_CUSTOM_VALUE",
        },
      },
    },
  },
};


// Example SELECT_SERVICE repayments for the amounts listed above
const SELECT_SERVICE_OPTIONS = {
  amount1: {
    months12: "₹ 63,000",
    months24: "₹ 33,000",
    months36: "₹ 23,000",
    months48: "₹ 18,000",
  },
  amount2: {
    months12: "₹ 28,000",
    months24: "₹ 14,600",
    months36: "₹ 10,000",
    months48: "₹ 8,000",
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
            return {
              ...SCREEN_RESPONSES.SERVICE_DETAILS,
              data: {
                // copy initial screen data then override specific fields
                ...SCREEN_RESPONSES.SERVICE_DETAILS.data,
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((s) => s.id === data.s_selected_bank_service)
                  .map((s) => s.title)[0],
                s_prn_number: data.s_prn_number
                  .filter((a) => a.id === data.s_prn_number)
                  .map((a) => a.title)[0]
              },

            };
          }
          // if service is nwsc
          if (data.s_selected_bank_service == "pay_nwsc") {
            return {
              ...SCREEN_RESPONSES.SERVICE_DETAILS,
              data: {
                // copy initial screen data then override specific fields
                ...SCREEN_RESPONSES.SERVICE_DETAILS.data,
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((a) => a.id === data.s_selected_bank_service)
                  .map((a) => a.title)[0],
                s_nwsc_area_selected: SCREEN_RESPONSES.SELECT_SERVICE.data.nwsc_area_selected
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
                // copy initial screen data then override specific fields
                ...SCREEN_RESPONSES.SERVICE_DETAILS.data,
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
                // copy initial screen data then override specific fields
                ...SCREEN_RESPONSES.SERVICE_DETAILS.data,
                s_tv_provider_selected: SCREEN_RESPONSES.SELECT_SERVICE.data.tv_providers
                  .filter((t) => t.id === data.s_tv_provider_selected)
                  .map((t) => t.title)[0],
                s_selected_bank_service: SCREEN_RESPONSES.SELECT_SERVICE.data.bank_service_type
                  .filter((a) => a.id === data.s_selected_bank_service)
                  .map((a) => a.title)[0],
                s_tv_card_no: data.s_tv_card_no,
               
              },

            };
          }

        }
        // otherwise refresh quote based on user selection
        return {
          ...SCREEN_RESPONSES.SELECT_SERVICE,
          data: {
            selected_amount: data.amount,
            selected_tenure: data.tenure,
            emi: SELECT_SERVICE_OPTIONS[data.amount][data.tenure],
          },
        };
      case "SERVICE_DETAILS":
        return {
          ...SCREEN_RESPONSES.PAYMENT_METHOD,
          data: {},
        };

      case "PAYMENT_METHOD":
        // Handles user selecting UPI or Banking selector
        if (data.payment_mode != null) {
          return {
            ...SCREEN_RESPONSES.SERVICE_DETAILS,
            data: {
              is_upi: data.payment_mode == "UPI",
              is_account: data.payment_mode == "Bank",
            },
          };
        }
        // Handles user clicking on Continue
        const payment_string =
          data.upi_id != null
            ? "Upi xxxx" + data.upi_id.slice(-4)
            : "account xxxx" + data.account_number.slice(-4);
        return {
          ...SCREEN_RESPONSES.SUMMARY,
          data: {
            // copy initial screen data then override specific fields
            ...SCREEN_RESPONSES.SUMMARY.data,
            amount: data.amount,
            tenure: data.tenure,
            emi: data.emi,
            payment_mode: "Transfer to " + payment_string,
          },
        };

      // handles when user completes SUMMARY screen
      case "SUMMARY":
        // TODO: save SELECT_SERVICE to your database and send money to user account
        // send success response to complete and close the flow
        return {
          ...SCREEN_RESPONSES.COMPLETE,
          data: {},
        };

      default:
        break;
    }
  }

  console.error("Unhandled request body:", decryptedBody);
  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};