import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import crypto from "crypto";
import logger from "./config/logger.js";
import router from "./routes/api.routes.js";
import {
  decryptRequest,
  encryptResponse,
  FlowEndpointException,
} from "./flows/encryption.js";
import { getNextScreen } from "./flows/flow.js";
import { getOpenAccountNextScreen } from "./flows/account_opening_flow.js";
import { getPayMerchantNextScreen } from "./flows/merchant_payment_flow.js";
import { getPRNPaymentNextScreen } from "./flows/ura_prn_flow.js";
import { getCustomerSupportNextScreen } from "./flows/customer_support_flow.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { URLSHORTNER } from "./services/url_shortner.service.js";
import path from "path";
import { fileURLToPath } from "url";
import { MapGenerator } from "./services/map.service.js";
import fs from "fs";
import database from "./config/database.js";
import { WhatsAppService } from "./services/whatsapp.service.js";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const server = createServer(app);
const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;
const APP_SECRET = process.env.APP_SECRET;

// Modify your Express app initialization
const app = express();

// Security and optimization middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(
  express.json({
    // store the raw request body to use it for signature verification
    verify: (req, res, buf, encoding) => {
      req.rawBody = buf?.toString(encoding || "utf8");
    },
  })
); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Logging middleware
app.use(
  morgan("combined", {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  })
);

// Define the folder containing static files
const staticFolderPath = path.join(__dirname, "public");

// Serve static files from the 'public' folder
app.use(express.static(staticFolderPath));

// Add this near your other path configurations
const viewsPath = path.join(__dirname, 'web_views');
app.set('view engine', 'ejs');
app.set('views', viewsPath);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

app.post("/pay_ura_tax", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your environment variable "PRIVATE_KEY".'
    );
  }

  if (!isRequestSignatureValid(req)) {
    return res.status(432).send("Invalid request signature");
  }

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Error decrypting request:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send(err.message);
    }
    return res.status(500).send("Internal server error during decryption");
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);
  try {
    const screenResponse = await getPRNPaymentNextScreen(decryptedBody);

    res.type("text/plain");
    res.send(
      encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
    );
  } catch (err) {
    console.error("Error processing next screen:", err);
    return res.status(500).send("Error processing the request");
  }
});

app.post("/flow", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your environment variable "PRIVATE_KEY".'
    );
  }

  // Validate request signature
  if (!isRequestSignatureValid(req)) {
    // Return status code 432 if the request signature does not match
    return res.status(432).send("Invalid request signature");
  }

  let decryptedRequest;
  try {
    // Attempt to decrypt the incoming request body
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Error decrypting request:", err);
    if (err instanceof FlowEndpointException) {
      // Custom error handling for FlowEndpointException, which has a specific status code
      return res.status(err.statusCode).send(err.message);
    }
    // General error catch-all for unexpected issues during decryption
    return res.status(500).send("Internal server error during decryption");
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;
  console.log("💬 Decrypted Request:", decryptedBody);

  // Optional flow token validation (if you want to implement token validation here)
  /*
  if (!isValidFlowToken(decryptedBody.flow_token)) {
    const errorResponse = {
      error_msg: "The message is no longer available",
    };
    return res
      .status(427)
      .send(encryptResponse(errorResponse, aesKeyBuffer, initialVectorBuffer));
  }
  */

  try {
    // Generate the next screen response based on the decrypted request body
    const screenResponse = await getNextScreen(decryptedBody);
    console.log("👉 Response to Encrypt:", screenResponse);

    res.type("text/plain");
    // Encrypt and send the response
    res.send(
      encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
    );
  } catch (err) {
    console.error("Error processing next screen:", err);
    // Handle potential errors from getNextScreen gracefully
    return res.status(500).send("Error processing the request");
  }
});

app.post("/generate-map", (req, res) => {
  try {
    const { lat, lon, zoom } = req.body;

    // Validate coordinates
    if (lat === undefined || lon === undefined) {
      return res.status(400).json({
        error: "Latitude and longitude are required",
      });
    }

    // Validate coordinate ranges
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({
        error: "Invalid coordinates",
      });
    }

    // Generate HTML
    const mapHTML = MapGenerator.generateMapHTML(lat, lon, zoom);

    // Generate unique filename
    const filename = `location_map_${lat}_${lon}_${Date.now()}.html`;

    // Use the mounted volume path for generating maps
    const filepath = path.join("/usr/src/app/src/public/maps", filename);

    // Ensure directory exists
    fs.mkdirSync(path.dirname(filepath), { recursive: true });

    // Write HTML file
    fs.writeFileSync(filepath, mapHTML);

    // Construct the URL path
    const fileUrl = `/maps/${filename}`;

    // Respond with file details
    res.json({
      message: "Map HTML generated successfully",
      filename,
      fileUrl,
      coordinates: { lat, lon },
    });
  } catch (error) {
    console.error("Map generation error:", error);
    res.status(500).json({
      error: "Failed to generate map",
      details: error.message,
    });
  }
});

app.get("/flow", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

app.post("/accountflow", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your environment variable "PRIVATE_KEY".'
    );
  }

  if (!isRequestSignatureValid(req)) {
    return res.status(432).send("Invalid request signature");
  }

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Error decrypting request:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send(err.message);
    }
    return res.status(500).send("Internal server error during decryption");
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;

  try {
    const screenResponse = await getOpenAccountNextScreen(decryptedBody);
    res.type("text/plain");
    res.send(
      encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
    );
  } catch (err) {
    console.error("Error processing next screen:", err);
    return res.status(500).send("Error processing the request");
  }
});

app.get("/accountflow", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout Account opening process</pre>`);
});

// API MERCHANT FLOW
app.post("/merchantflow", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your environment variable "PRIVATE_KEY".'
    );
  }

  if (!isRequestSignatureValid(req)) {
    return res.status(432).send("Invalid request signature");
  }

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Error decrypting request:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send(err.message);
    }
    return res.status(500).send("Internal server error during decryption");
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;

  try {
    const screenResponse = await getPayMerchantNextScreen(decryptedBody);
    res.type("text/plain");
    res.send(
      encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
    );
  } catch (err) {
    console.error("Error processing next screen:", err);
    return res.status(500).send("Error processing the request");
  }
});

app.get("/merchantflow", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout Merchant Payments</pre>`);
});

// API CUstomer Support FLOW
app.post("/customer_support_flow", async (req, res) => {
  if (!PRIVATE_KEY) {
    throw new Error(
      'Private key is empty. Please check your environment variable "PRIVATE_KEY".'
    );
  }

  if (!isRequestSignatureValid(req)) {
    return res.status(432).send("Invalid request signature");
  }

  let decryptedRequest;
  try {
    decryptedRequest = decryptRequest(req.body, PRIVATE_KEY, PASSPHRASE);
  } catch (err) {
    console.error("Error decrypting request:", err);
    if (err instanceof FlowEndpointException) {
      return res.status(err.statusCode).send(err.message);
    }
    return res.status(500).send("Internal server error during decryption");
  }

  const { aesKeyBuffer, initialVectorBuffer, decryptedBody } = decryptedRequest;

  try {
    const screenResponse = await getCustomerSupportNextScreen(decryptedBody);
    res.type("text/plain");
    res.send(
      encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer)
    );
  } catch (err) {
    console.error("Error processing next screen:", err);
    return res.status(500).send("Error processing the request");
  }
});

app.get("/customer_support_flow", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout Merchant Payments</pre>`);
});

// get account requests
app.get("/accountrequests", async (req, res) => {
  try {
    const users = await database.getAllAccountsRequest();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch account requests" });
  }
});

// get account request by id, check if id is passsed
app.get("/accountrequests/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ error: "Account request ID is required" });
  }

  console.log("Fetching account request with ID:", id);

  try {
    const user = await database.getAccountRequestDetailsByAccountID(id);
    if (!user) {
      return res.status(404).json({ error: "Account request not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch account request" });
  }
});

// get users and last chat message
app.get("/manager/userschatlist", async (req, res) => {
  try {
    const users = await database.getUsersWithLastChatMessage();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users chat list" });
  }
});

app.get("/manager/userChatHistory/:user_ID", async (req, res) => {
  try {
    const userID = req.params.user_ID;
    if (!userID) {
      return res.status(400).json({ error: "User ID is required" });
    }
    const users = await database.GetUserMessagesWithDateRange(userID);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user chat history" });
  }
});

app.post("/manager/BroadcastAPI", async (req, res) => {
  try {
    const { userPhone, userId, messageContent } = req.body;
    // Create the new message object
    const newMessage = {
      id: Date.now().toString(),
      to_contact: userPhone,
      selected_user_id: userId,
      msg_source: userPhone,
      content: messageContent,
      timestamp: new Date(
        new Date().getTime() + 3 * 60 * 60 * 1000
      ).toISOString(),
    };

    const broadcast_data = {
      roomId: userId,
      message: newMessage,
    };

    // use fetch to post the message to the server
    const response = await WhatsAppService.sendMessageToSocket(broadcast_data);
    res.status(200).json({ status: true, message: response });
  } catch (error) {
    res.status(400).json({ status: false, message: error });
  }
});

app.post("/manager/sendUserMessage", async (req, res) => {
  const { phonenumber, message_text } = req.body;

  if (!phonenumber) {
    return res.status(400).json({
      error: "phone number is required",
      details: "Missing phone number",
    });
  }
  if (!message_text) {
    return res.status(400).json({
      error: "message is required",
      details: "Missing Message",
    });
  }

  const response = await WhatsAppService.sendManualMessage(
    phonenumber,
    message_text
  );
  res.status(200).json(response);
});

app.post("/manager/updateUserChatState", async (req, res) => {
  const { userID, handover_to_human } = req.body;
  let handover_to_human_state = false;

  try {
    //handover is boolean, if false set to 0, if true set to 1
    if (!userID) {
      return res.status(400).json({
        error: "userID is required",
        details: "Missing userID",
      });
    }
    if (handover_to_human === true) {
      handover_to_human_state = true;
    } else {
      handover_to_human_state = false;
    }

    await database.updateUserChatState(userID, handover_to_human_state);
    res
      .status(200)
      .json({ status: true, message: "User chat state updated successfully" });
  } catch (error) {
    console.error("Error updating user chat state:", error);
    res
      .status(400)
      .json({ status: false, message: "Error updating user chat state" });
  }
});

// API routes
app.use("/api/whatsapp", router);

app.use("/maps", express.static(path.join(__dirname, "generated-maps")));

app.get("/", (req, res) => {
  res.render('landing');
});

app.get("/:shortCode", (req, res) => {
  const shortCode = req.params.shortCode;
  const urls = URLSHORTNER.loadUrls();
  const originalUrl = urls[shortCode];
  if (originalUrl) {
    res.redirect(originalUrl);
  } else {
    res.status(404).json({ error: "Short URL not found" });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Handle unhandled rejections
process.on("unhandledRejection", (error) => {
  logger.error("Unhandled Rejection:", error);
  process.exit(1);
});

function isRequestSignatureValid(req) {
  if (!APP_SECRET) {
    console.warn(
      "App Secret is not set up. Please add your app secret in the .env file to check for request validation."
    );
    return true;
  }

  const signatureHeader = req.get("x-hub-signature-256");

  // Check if the signature header exists
  if (!signatureHeader) {
    console.error("Error: Signature header is missing from the request.");
    return false;
  }

  const signatureBuffer = Buffer.from(
    signatureHeader.replace("sha256=", ""),
    "utf-8"
  );

  const hmac = crypto.createHmac("sha256", APP_SECRET);
  const digestString = hmac.update(req.rawBody).digest("hex");
  const digestBuffer = Buffer.from(digestString, "utf-8");

  if (!crypto.timingSafeEqual(digestBuffer, signatureBuffer)) {
    console.error("Error: Request signature did not match.");
    return false;
  }

  return true;
}

export default app;
