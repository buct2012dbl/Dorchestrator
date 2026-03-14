module.exports = {
  // Response summarization
  summarization: {
    enabled: false,        // DISABLED - PTY output is too messy to parse reliably
    maxChars: 4000,
    extractKeyInfo: true,
  },

  // Timeout settings
  timeout: {
    idleStart: 2000,      // Initial idle timeout (ms)
    idleMax: 6000,        // Maximum idle timeout (ms)
    safety: 180000,       // Hard timeout (ms)
    adaptive: true,       // Enable adaptive timeout
  },

  // History compression
  history: {
    recentCount: 5,       // Keep last N messages in full
    maxMessageLength: 1000, // Increased from 500 to preserve more context
    enabled: true,
  },

  // Parallel messaging
  parallel: {
    enabled: true,
    maxConcurrent: 10,    // Max parallel messages
  },
};
