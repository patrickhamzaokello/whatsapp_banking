import logger from '../config/logger.js';
import { TestMessageHandler } from '../handlers/test.message.handler.js';

class MessageQueue {
  constructor(concurrency = 3) {
    this.queue = [];
    this.processing = new Set();
    this.concurrency = concurrency;
    this.isProcessing = false;
  }

  // Add message to queue
  async enqueue(message, contact, businessPhoneNumberId) {
    this.queue.push({ message, contact, businessPhoneNumberId });
    logger.info('Message added to queue', { 
      messageId: message.id, 
      queueLength: this.queue.length 
    });
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Process messages in queue
  async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.processing.size < this.concurrency) {
        const item = this.queue.shift();
        if (!item) continue;

        const { message, contact, businessPhoneNumberId } = item;
        const processId = message.id;
        
        if (this.processing.has(processId)) continue;
        
        this.processing.add(processId);
        
        // Process message asynchronously
        this.processMessage(message, contact, businessPhoneNumberId, processId)
          .catch(error => {
            logger.error('Error processing message', { 
              error, 
              messageId: message.id 
            });
          });
      }
    } catch (error) {
      logger.error('Error in queue processing', { error });
    } finally {
      this.isProcessing = this.queue.length > 0;
      
      // If there are remaining messages, continue processing
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  // Process individual message
  async processMessage(message, contact, businessPhoneNumberId, processId) {
    try {
      await TestMessageHandler.handleIncoming(message, contact, businessPhoneNumberId);
      logger.info('Message processed successfully', { messageId: message.id });
    } catch (error) {
      logger.error('Failed to process message', { 
        error, 
        messageId: message.id 
      });
      
      // Implement retry logic
      if (!message.retryCount || message.retryCount < 3) {
        message.retryCount = (message.retryCount || 0) + 1;
        this.queue.push({ message, contact, businessPhoneNumberId });
        logger.info('Message requeued for retry', { 
          messageId: message.id, 
          retryCount: message.retryCount 
        });
      }
    } finally {
      this.processing.delete(processId);
      
      // If queue still has items and we're below concurrency limit, process more
      if (this.queue.length > 0 && this.processing.size < this.concurrency) {
        this.processQueue();
      }
    }
  }

  // Get current queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing.size,
      isProcessing: this.isProcessing
    };
  }

  // Clear the queue
  clear() {
    this.queue = [];
    logger.info('Queue cleared');
  }
}

// Create singleton instance
const messageQueue = new MessageQueue();
export default messageQueue;