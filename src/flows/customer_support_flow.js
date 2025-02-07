
const SCREEN_RESPONSES = {
  CUSTOMER_QUERIES: {
    screen: "CUSTOMER_QUERIES",
    data: {

    }
  },

};

export const getCustomerSupportNextScreen = async (decryptedBody) => {
  const { screen, data, version, action, flow_token } = decryptedBody;
  if (action === "ping") {
    return {
      data: {
        status: "active",
      },
    };
  }

  if (data?.error) {
    console.warn("Received client error:", data);
    return {
      data: {
        acknowledged: true,
      },
    };
  }

  if (action === "INIT") {
    return {
      ...SCREEN_RESPONSES.CUSTOMER_QUERIES,
    };
  }

  

  throw new Error(
    "Unhandled endpoint request. Make sure you handle the request action & screen logged above."
  );
};