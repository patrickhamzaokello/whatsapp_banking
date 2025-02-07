import { kind } from "openai/_shims/index.mjs";

const SCREEN_RESPONSES = {
  ACCOUNT: {
    screen: "ACCOUNT",
    data: {
      selected_account_type: "digital",
      selected_account_currency: "ugx",
      account_currency: [
        {
          id: "UGX",
          title: "UGX"
        },
        {
          id: "USD",
          title: "USD"
        },
        {
          id: "EURO",
          title: "EURO"
        },
        {
          id: "GBP",
          title: "GBP"
        }
      ],
      account_type: [
        {
          id: "Digital Account",
          title: "Digital Account"
        },
        {
          id: "Savings Account",
          title: "Savings Account"
        }
      ],


    },
  },
  PERSONAL_INFO: {
    screen: "PERSONAL_INFO",
    data: {
      s_account_currency: "usd",
      account_currency_label: "usd",
      s_account_type: "savings",
      account_type_label: "savings",

    }
  },
  CONTACT_DETAILS: {
    screen: "CONTACT_DETAILS",
    data: {
      s_account_currency: "currency",
      s_account_type: "type",
      firstname: "firstname",
      middlename: "middlename",
      lastname: "lastname",
      gender: "gender",
      marital_status: "marital_status",
      date_of_birth: "date_of_birth",
    }
  },

  PROFILE_IMAGE: {
    screen: "PROFILE_IMAGE",
    data: {
      main_phone_number: "main_phone",
      second_phone_number: "second_phone_number",
      email_address: "email_address",
      location: "location",
      firstname: "firstname",
      middlename: "middlename",
      lastname: "lastname",
      gender: "gender",
      marital_status: "marital_status",
      date_of_birth: "date_of_birth",
      s_account_type: "s_account_type",
      s_account_currency: "s_account_currency"
    }
  },
  NATIONAL_ID: {
    screen: "NATIONAL_ID",
    data: {
      profileImage: "data.profileImage",
      main_phone_number: " data.main_phone_number",
      second_phone_number: "data.second_phone_number",
      email_address: "data.email_address",
      location: "data.location",

      s_account_currency: "data.s_account_currency",
      s_account_type: "data.s_account_type",
      firstname: "data.firstname",
      middlename: "data.middlename",
      lastname: "data.lastname",
      gender: "data.gender",
      marital_status: "data.marital_status",
      date_of_birth: "data.date_of_birth",
    }
  },
  NEXT_OF_KIN: {
    screen: "NEXT_OF_KIN",
    data: {
      national_id_images: "data.national_id_images",
      profileImage: "data.profileImage",
      main_phone_number: " data.main_phone_number",
      second_phone_number: "data.second_phone_number",
      email_address: "data.email_address",
      location: "data.location",
      national_id_card_number: "data.national_id_card_number",
      national_id_nin: "data.national_id_nin",
      s_account_currency: "data.s_account_currency",
      s_account_type: "data.s_account_type",
      firstname: "data.firstname",
      middlename: "data.middlename",
      lastname: "data.lastname",
      gender: "data.gender",
      marital_status: "data.marital_status",
      date_of_birth: "data.date_of_birth",
    }
  },
  DEPOSIT_PROTECTION: {
    screen: "DEPOSIT_PROTECTION",
    data: {
      kin_othername: "sedrick",
      kin_lastname: "sedrick",
      kin_firstname: "sedrick",
      kin_phone_number: "0787412145",
      kin_email_address: "pkase@gmail.com",
      kin_relationship: "brother",
      national_id_images: "data.national_id_images",
      profileImage: "data.profileImage",
      main_phone_number: "0787250196",
      email_address: "pkasemer@gmail.com",
      location: "loro",
      national_id_card_number: "data.national_id_card_number",
      national_id_nin: "data.national_id_nin",
      firstname: "data.firstname",
      middlename: "data.middlename",
      lastname: "data.lastname",
      gender: "Male",
      marital_status: "Single",
      date_of_birth: "2024-12-10",
      s_account_type: "Digital_account",
      s_account_currency: "usd"
    }
  },
  SIGNATURE: {
    screen: "SIGNATURE",
    data: {
      kin_othername: "sedrick",
      kin_lastname: "sedrick",
      kin_firstname: "sedrick",
      kin_phone_number: "0787412145",
      kin_email_address: "pkase@gmail.com",
      kin_relationship: "brother",
      national_id_images: "data.national_id_images",
      profileImage: "data.profileImage",
      main_phone_number: "0787250196",
      email_address: "pkasemer@gmail.com",
      location: "loro",
      firstname: "data.firstname",
      middlename: "data.middlename",
      lastname: "data.lastname",
      gender: "Male",
      national_id_card_number: "data.national_id_card_number",
      national_id_nin: "data.national_id_nin",
      marital_status: "Single",
      date_of_birth: "2024-12-10",
      s_account_type: "Digital_account",
      s_account_currency: "usd",
      dp_mode_of_payment: "Mobile Money",
      dp_institution_name: "rack ka",
      dp_account_mobile_no: "0787236147",
      dp_account_name: "pk"
    }
  },
  TERMS_CONDITIONS: {
    screen: "TERMS_CONDITIONS",
    data: {
      kin_othername: "sedrick",
      kin_lastname: "sedrick",
      kin_firstname: "sedrick",
      kin_phone_number: "0787412145",
      kin_email_address: "pkase@gmail.com",
      kin_relationship: "brother",
      national_id_images: "data.national_id_images",
      profileImage: "data.profileImage",
      signature_image: "data.signature_image",
      main_phone_number: "0787250196",
      email_address: "pkasemer@gmail.com",
      location: "loro",
      firstname: "data.firstname",
      middlename: "data.middlename",
      lastname: "data.lastname",
      gender: "Male",
      national_id_card_number: "data.national_id_card_number",
      national_id_nin: "data.national_id_nin",
      marital_status: "Single",
      date_of_birth: "2024-12-10",
      s_account_type: "Digital_account",
      s_account_currency: "usd",
      dp_mode_of_payment: "Mobile Money",
      dp_institution_name: "rack ka",
      dp_account_mobile_no: "0787236147",
      dp_account_name: "pk"
    }
  },
  TERMS_CONDITIONS_DETAILS: {
    screen: "TERMS_CONDITIONS_DETAILS",
    data: {

    }
  },
  SUMMARY: {
    screen: "SUMMARY",
    data: {
      key_fact_agreement: true,
      collection_agreement: true,
      personal_data_agreement: true,
      account_summary_message: "message_summary",
      kin_othername: "sedrick",
      kin_lastname: "sedrick",
      kin_firstname: "sedrick",
      kin_phone_number: "0787412145",
      kin_email_address: "pkase@gmail.com",
      kin_relationship: "brother",
      national_id_images: "data.national_id_images",
      profileImage: "data.profileImage",
      signature_image: "data.signature_image",
      main_phone_number: "0787250196",
      email_address: "pkasemer@gmail.com",
      location: "loro",
      firstname: "data.firstname",
      middlename: "data.middlename",
      lastname: "data.lastname",
      gender: "Male",
      national_id_card_number: "data.national_id_card_number",
      national_id_nin: "data.national_id_nin",
      marital_status: "Single",
      date_of_birth: "2024-12-10",
      s_account_type: "Digital_account",
      s_account_currency: "usd",
      dp_mode_of_payment: "Mobile Money",
      dp_institution_name: "rack ka",
      dp_account_mobile_no: "0787236147",
      dp_account_name: "pk"
    },
  },
};

export const getOpenAccountNextScreen = async (decryptedBody) => {
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
      case "ACCOUNT":

        // Handles user clicking on Continue to navigate to next screen
        if (data.s_account_type != null && data.s_account_currency != null) {

          return {
            ...SCREEN_RESPONSES.PERSONAL_INFO,
            data: {
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              s_error_message: "",
            },

          };
        }
        // otherwise refresh
        return {
          ...SCREEN_RESPONSES.ACCOUNT,
        };
      case "PERSONAL_INFO":

        if(data.user_selected_date_of_birth != null){

          // "user_selected_date_of_birth": "2024-07-31"
          // return true if a user is above 18 other false
          const userDateOfBirth = new Date(data.user_selected_date_of_birth);
          const currentDate = new Date();
          const ageDifference = currentDate - userDateOfBirth;
          const ageInYears = ageDifference / (1000 * 60 * 60 * 24 * 365.25);

          return  {
            ...SCREEN_RESPONSES.PERSONAL_INFO,
            data: {
              s_isabove18: ageInYears >= 18,
              s_birth_date: data.user_selected_date_of_birth,
              s_age: Math.round(ageInYears),
              s_age_diff: Math.round(ageDifference),
              s_error_message: "",
            }
          }

        }

        if(data.s_isabove18 == false){
          return {
            ...SCREEN_RESPONSES.PERSONAL_INFO,
            data : {
              s_error_message: "You must be at least 18 years old to open an account."
            }
          }
        }

        if (data.firstname != null && data.lastname != null && data.date_of_birth != null && data.gender != null) {
          return {
            ...SCREEN_RESPONSES.CONTACT_DETAILS,
            data: {
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              user_title: data.user_title,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },

          };
        }

        // otherwise refresh
        return {
          ...SCREEN_RESPONSES.PERSONAL_INFO,
        };

      case "CONTACT_DETAILS":
        if (data.main_phone_number != null && data.email_address != null && data.location != null) {
          return {
            ...SCREEN_RESPONSES.PROFILE_IMAGE,
            data: {
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              user_title: data.user_title,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },

          };

        }

        // otherwise refresh
        return {
          ...SCREEN_RESPONSES.CONTACT_DETAILS,
        };

      case "PROFILE_IMAGE":
        if (data.profileImage != null) {
          return {
            ...SCREEN_RESPONSES.NATIONAL_ID,
            data: {
              profileImage: data.profileImage,
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              user_title: data.user_title,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },

          };

        }

        // otherwise refresh
        return {
          ...SCREEN_RESPONSES.PROFILE_IMAGE,
        };

      case "NATIONAL_ID":
        if (data.national_id_images != null) {
          return {
            ...SCREEN_RESPONSES.NEXT_OF_KIN,
            data: {
              national_id_images: data.national_id_images,
              profileImage: data.profileImage,
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              user_title: data.user_title,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              national_id_card_number: data.national_id_card_number,
              national_id_nin: data.national_id_nin,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },
          };
        }

        // otherwise refresh
        return {
          ...SCREEN_RESPONSES.NATIONAL_ID,
        };

      case "NEXT_OF_KIN":

        if (data.kin_firstname != null && data.kin_lastname != null && data.kin_phone_number != null && data.kin_email_address != null && data.kin_relationship != null) {
          return {
            ...SCREEN_RESPONSES.DEPOSIT_PROTECTION,
            data: {

              kin_othername: data.kin_othername,
              kin_lastname: data.kin_lastname,
              kin_firstname: data.kin_firstname,

              kin_phone_number: data.kin_phone_number,
              kin_email_address: data.kin_email_address,
              kin_relationship: data.kin_relationship,

              national_id_images: data.national_id_images,
              profileImage: data.profileImage,
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              user_title: data.user_title,
              national_id_card_number: data.national_id_card_number,
              national_id_nin: data.national_id_nin,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },
          };
        }

        // otherwise refresh
        return {
          ...SCREEN_RESPONSES.NEXT_OF_KIN,
        };
      case "DEPOSIT_PROTECTION":

        let institutionName = '';
        let sdp_account_mobile_no = '';
        let sdp_account_name = '';
        // set institutionName to dp_institution_name or dp_network_name
        if (data.dp_mode_of_payment == 'MobileMoney') {
          institutionName = data.dp_network_name;
          sdp_account_mobile_no = data.dp_user_phone_no;
          sdp_account_name = data.dp_mobile_registerd_name;
        } else {
          institutionName = data.dp_institution_name
          sdp_account_mobile_no = data.dp_account_number;
          sdp_account_name = data.dp_bank_account_name;
        }


        if (data.dp_mode_of_payment != null && institutionName != null && sdp_account_mobile_no != null && sdp_account_name != null) {
          return {
            ...SCREEN_RESPONSES.SIGNATURE,
            data: {

              dp_mode_of_payment: data.dp_mode_of_payment,
              dp_institution_name: institutionName,
              dp_account_mobile_no: sdp_account_mobile_no,
              dp_account_name: sdp_account_name,
              user_title: data.user_title,
              kin_othername: data.kin_othername,
              kin_lastname: data.kin_lastname,
              kin_firstname: data.kin_firstname,
              kin_phone_number: data.kin_phone_number,
              kin_email_address: data.kin_email_address,
              kin_relationship: data.kin_relationship,

              national_id_images: data.national_id_images,
              profileImage: data.profileImage,
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              national_id_card_number: data.national_id_card_number,
              national_id_nin: data.national_id_nin,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },
          };
        }

        // other wise just refresh the screen
        return {
          ...SCREEN_RESPONSES.DEPOSIT_PROTECTION,
        };
      case "SIGNATURE":
        if (data.signature_image != null) {
          return {
            ...SCREEN_RESPONSES.TERMS_CONDITIONS,
            data: {
              signature_image: data.signature_image,
              dp_mode_of_payment: data.dp_mode_of_payment,
              dp_institution_name: data.dp_institution_name,
              dp_account_mobile_no: data.dp_account_mobile_no,
              dp_account_name: data.dp_account_name,

              kin_othername: data.kin_othername,
              kin_lastname: data.kin_lastname,
              kin_firstname: data.kin_firstname,
              kin_phone_number: data.kin_phone_number,
              kin_email_address: data.kin_email_address,
              kin_relationship: data.kin_relationship,
              user_title: data.user_title,
              national_id_images: data.national_id_images,
              profileImage: data.profileImage,
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              national_id_card_number: data.national_id_card_number,
              national_id_nin: data.national_id_nin,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
            },
          };
        }

        // other wise just refresh the screen
        return {
          ...SCREEN_RESPONSES.SIGNATURE,
        };
      case "TERMS_CONDITIONS":
        if (data.key_fact_agreement != null && data.collection_agreement != null && data.personal_data_agreement != null) {

          //conbine firstname, lastname and middle name to create fullname
          const fullname = `${data.firstname} ${data.middlename || ''} ${data.lastname}`.trim();

          const kin_fullname = `${data.kin_firstname} ${data.kin_othername || ''} ${data.kin_lastname}`.trim();

          const summaryMessage = `
Personal Information
- Title: ${data.user_title} 
- Full Name: ${fullname}
- Gender: ${data.gender}
- Marital Status: ${data.marital_status}
- Date of Birth: ${data.date_of_birth}
- Mobile Number: ${data.main_phone_number}
- Email Address: ${data.email_address}
- Location: ${data.location}

Account Type Details
- Account Currency: ${data.s_account_currency.toUpperCase()}
- Account Type: ${data.s_account_type}

National ID Details
- National ID Card Number: ${data.national_id_card_number}
- National ID NIN: ${data.national_id_nin}

Next of Kin Information
- Full Name: ${kin_fullname}
- Relationship: ${data.kin_relationship}
- Phone Number: ${data.kin_phone_number}
- Email Address: ${data.kin_email_address}

Deposit Protection Information
- Institution Name: ${data.dp_institution_name}
- Account Name / Registered Name: ${data.dp_account_name}
- Account No / Mobile Number: ${data.dp_account_mobile_no}
- Mode of Payment: ${data.dp_mode_of_payment}

Agreements
- Key Fact Agreement: ${data.key_fact_agreement ? "✅" : "❌"}
- Collection Agreement: ${data.collection_agreement ? "✅" : "❌"}
- Personal Data Agreement: ${data.personal_data_agreement ? "✅" : "❌"}

Uploaded Files
- Signature Image: ${data.signature_image[0].file_name}
- National ID Images:
  1. ${data.national_id_images[0].file_name}
  2. ${data.national_id_images[1].file_name}
- Profile Image: ${data.profileImage[0].file_name}
`;
          return {
            ...SCREEN_RESPONSES.SUMMARY,
            data: {
              key_fact_agreement: data.key_fact_agreement,
              collection_agreement: data.collection_agreement,
              personal_data_agreement: data.personal_data_agreement,

              signature_image: data.signature_image,
              dp_mode_of_payment: data.dp_mode_of_payment,
              dp_institution_name: data.dp_institution_name,
              dp_account_mobile_no: data.dp_account_mobile_no,
              dp_account_name: data.dp_account_name,
              national_id_card_number: data.national_id_card_number,
              national_id_nin: data.national_id_nin,
              kin_othername: data.kin_othername,
              kin_lastname: data.kin_lastname,
              kin_firstname: data.kin_firstname,
              kin_phone_number: data.kin_phone_number,
              kin_email_address: data.kin_email_address,
              kin_relationship: data.kin_relationship,
              user_title: data.user_title,
              national_id_images: data.national_id_images,
              profileImage: data.profileImage,
              main_phone_number: data.main_phone_number,
              second_phone_number: data.second_phone_number,
              email_address: data.email_address,
              location: data.location,
              s_account_currency: data.s_account_currency,
              s_account_type: data.s_account_type,
              firstname: data.firstname,
              middlename: data.middlename,
              lastname: data.lastname,
              gender: data.gender,
              marital_status: data.marital_status,
              date_of_birth: data.date_of_birth,
              account_summary_message: summaryMessage
            },
          };
        }

        return {
          ...SCREEN_RESPONSES.TERMS_CONDITIONS,
        };
      case "TERMS_CONDITIONS_DETAILS":
        return {
          ...SCREEN_RESPONSES.TERMS_CONDITIONS,
          data: {
          },
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