import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import crypto from "crypto";
import logger from './config/logger.js';
import router from './routes/api.routes.js';
import { decryptRequest, encryptResponse, FlowEndpointException } from "./flows/encryption.js";
import { getNextScreen } from "./flows/flow.js";
import { errorHandler } from './middleware/error.middleware.js';
import { URLSHORTNER } from './services/url_shortner.service.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PASSPHRASE = process.env.PASSPHRASE;
const APP_SECRET = process.env.APP_SECRET;
// Security and optimization middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(compression()); // Compress responses
app.use(express.json({
  // store the raw request body to use it for signature verification
  verify: (req, res, buf, encoding) => {
    req.rawBody = buf?.toString(encoding || "utf8");
  },
})); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: message => logger.info(message.trim())
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
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

    res.type('text/plain');
    // Encrypt and send the response
    res.send(encryptResponse(screenResponse, aesKeyBuffer, initialVectorBuffer));
  } catch (err) {
    console.error("Error processing next screen:", err);
    // Handle potential errors from getNextScreen gracefully
    return res.status(500).send("Error processing the request");
  }
});

app.get("/flow", (req, res) => {
  res.send(`<pre>Nothing to see here.
Checkout README.md to start.</pre>`);
});

// API routes
app.use('/api/whatsapp', router);

app.get('/', (req, res) => {
  res.send('<b>Welcome</b>').status(200);
});

app.get('/:shortCode', (req, res) => {
  const shortCode = req.params.shortCode;
  const urls = URLSHORTNER.loadUrls();
  const originalUrl = urls[shortCode];
  if (originalUrl) {
    res.redirect(originalUrl);
  } else {
    res.status(404).json({ error: 'Short URL not found' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found'
  });
});

// Global error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
});


function isRequestSignatureValid(req) {
  if (!APP_SECRET) {
    console.warn("App Secret is not set up. Please add your app secret in the .env file to check for request validation.");
    return true;
  }

  const signatureHeader = req.get("x-hub-signature-256");

  // Check if the signature header exists
  if (!signatureHeader) {
    console.error("Error: Signature header is missing from the request.");
    return false;
  }

  const signatureBuffer = Buffer.from(signatureHeader.replace("sha256=", ""), "utf-8");

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