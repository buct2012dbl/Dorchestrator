'use strict';

class SwarmBridgeDispatchQueue {
  constructor() {
    this.chains = new Map();
  }

  enqueue(agentId, task) {
    const key = String(agentId || '').trim();
    if (!key) {
      return Promise.reject(new Error('Agent id is required for swarm bridge dispatch'));
    }
    if (typeof task !== 'function') {
      return Promise.reject(new Error('Swarm bridge dispatch task must be a function'));
    }

    const previous = this.chains.get(key) || Promise.resolve();
    const next = previous.catch(() => {}).then(() => task());
    const cleanup = next
      .then(() => {}, () => {})
      .finally(() => {
        if (this.chains.get(key) === cleanup) {
          this.chains.delete(key);
        }
      });

    this.chains.set(key, cleanup);
    return next;
  }
}

module.exports = {
  SwarmBridgeDispatchQueue,
};
