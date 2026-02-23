import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logDir = './logs';
    this.logFile = path.join(this.logDir, 'bot.log');
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = this.levels.INFO;
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level}: ${message}${dataStr}`;
  }

  writeToFile(formattedMessage) {
    try {
      fs.appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  log(level, message, data = null) {
    if (this.levels[level] > this.currentLevel) return;
    
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Console output
    switch (level) {
      case 'ERROR':
        console.error(`\x1b[31m${formattedMessage}\x1b[0m`);
        break;
      case 'WARN':
        console.warn(`\x1b[33m${formattedMessage}\x1b[0m`);
        break;
      case 'INFO':
        console.log(`\x1b[36m${formattedMessage}\x1b[0m`);
        break;
      case 'DEBUG':
        console.log(`\x1b[37m${formattedMessage}\x1b[0m`);
        break;
    }
    
    // File output
    this.writeToFile(formattedMessage);
  }

  error(message, data = null) {
    this.log('ERROR', message, data);
  }

  warn(message, data = null) {
    this.log('WARN', message, data);
  }

  info(message, data = null) {
    this.log('INFO', message, data);
  }

  debug(message, data = null) {
    this.log('DEBUG', message, data);
  }
}

export default new Logger();
