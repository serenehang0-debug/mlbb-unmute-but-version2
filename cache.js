import logger from './logger.js';

class Cache {
  constructor() {
    this.roles = new Map();
    this.channels = new Map();
    this.members = new Map();
    this.lastUpdate = 0;
    this.updateInterval = 60000; // 1 minute
  }

  async updateCache(guild) {
    try {
      logger.debug('Updating cache...');
      
      // Cache roles
      guild.roles.cache.forEach(role => {
        this.roles.set(role.id, role);
      });
      
      // Cache channels
      guild.channels.cache.forEach(channel => {
        this.channels.set(channel.id, channel);
      });
      
      // Cache members (limit to active members to save memory)
      const activeMembers = guild.members.cache.filter(member => 
        member.voice.channelId || member.roles.cache.size > 1
      );
      
      activeMembers.forEach(member => {
        this.members.set(member.id, member);
      });
      
      this.lastUpdate = Date.now();
      logger.debug('Cache updated successfully', {
        roles: this.roles.size,
        channels: this.channels.size,
        members: this.members.size
      });
      
    } catch (error) {
      logger.error('Failed to update cache', { error: error.message });
    }
  }

  needsUpdate() {
    return Date.now() - this.lastUpdate > this.updateInterval;
  }

  getRole(roleId) {
    return this.roles.get(roleId);
  }

  getChannel(channelId) {
    return this.channels.get(channelId);
  }

  getMember(memberId) {
    return this.members.get(memberId);
  }

  hasRole(memberId, roleId) {
    const member = this.getMember(memberId);
    return member ? member.roles.cache.has(roleId) : false;
  }

  hasAnyRole(memberId, roleIds) {
    const member = this.getMember(memberId);
    if (!member) return false;
    return roleIds.some(roleId => member.roles.cache.has(roleId));
  }

  isExemptChannel(channelId) {
    return this.channels.has(channelId) && 
           this.getChannel(channelId).name.toLowerCase().includes('afk');
  }

  clear() {
    this.roles.clear();
    this.channels.clear();
    this.members.clear();
    this.lastUpdate = 0;
    logger.debug('Cache cleared');
  }
}

export default new Cache();
