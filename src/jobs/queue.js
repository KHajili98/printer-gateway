'use strict';

const { config } = require('../config');
const { sendToPrinter } = require('../printer/tcp-sender');
const { logger } = require('../middleware/logger');

class PrintQueue {
  constructor() {
    this.pending = [];
    this.processing = false;
  }

  enqueue(job) {
    this.pending.push(job);
    this.process();
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.pending.length > 0) {
      const job = this.pending.shift();
      await this.runWithRetry(job);
    }

    this.processing = false;
  }

  async runWithRetry(job) {
    const maxAttempts = config.printRetryCount;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const result = await sendToPrinter(job.text, job.ip, job.port);
        if (job.onSuccess) {
          job.onSuccess(result);
        }
        return result;
      } catch (err) {
        lastError = err;
        logger.warn(
          { attempt, maxAttempts, ip: job.ip, error: err.code || err.message },
          `cap retry: ${job.ip} — cəhd ${attempt}/${maxAttempts} ugursuz`
        );

        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, config.printRetryDelayMs));
        }
      }
    }

    if (job.onFailure) {
      job.onFailure(lastError);
    }

    throw lastError;
  }
}

const printQueue = new PrintQueue();

module.exports = { PrintQueue, printQueue };
