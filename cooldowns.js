import logger from './logger.js';

class CooldownManager {
  constructor() {
    this.cooldowns = new Map();
  }

  setCooldown(userId, commandId, duration) {
    const key = `${userId}-${commandId}`;
    this.cooldowns.set(key, Date.now() + duration);
    
    // Auto-cleanup after duration
    setTimeout(() => {
      this.cooldowns.delete(key);
    }, duration);
    
    logger.debug('Cooldown set', { userId, commandId, duration });
  }

  isOnCooldown(userId, commandId) {
    const key = `${userId}-${commandId}`;
    const endTime = this.cooldowns.get(key);
    
    if (!endTime) return false;
    
    if (Date.now() > endTime) {
      this.cooldowns.delete(key);
      return false;
    }
    
    return true;
  }

  getRemainingTime(userId, commandId) {
    const key = `${userId}-${commandId}`;
    const endTime = this.cooldowns.get(key);
    
    if (!endTime) return 0;
    
    const remaining = endTime - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  clearCooldown(userId, commandId) {
    const key = `${userId}-${commandId}`;
    this.cooldowns.delete(key);
    logger.debug('Cooldown cleared', { userId, commandId });
  }

  clearAllCooldowns() {
    this.cooldowns.clear();
    logger.debug('All cooldowns cleared');
  }

  getActiveCooldownsCount() {
    return this.cooldowns.size;
  }
}

export default new CooldownManager();
