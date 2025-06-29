// Notification Service for User Feedback and Developer Monitoring
export class NotificationService {
  constructor() {
    this.notifications = [];
    this.listeners = new Set();
  }

  // User-facing notifications
  showSuccess(message, details = {}) {
    this.addNotification({
      type: 'success',
      message,
      details,
      timestamp: new Date().toISOString(),
      duration: 5000 // 5 seconds
    });
  }

  showError(message, details = {}) {
    this.addNotification({
      type: 'error',
      message,
      details,
      timestamp: new Date().toISOString(),
      duration: 8000 // 8 seconds
    });
  }

  showInfo(message, details = {}) {
    this.addNotification({
      type: 'info',
      message,
      details,
      timestamp: new Date().toISOString(),
      duration: 4000 // 4 seconds
    });
  }

  // Add notification and notify listeners
  addNotification(notification) {
    const notificationWithId = {
      ...notification,
      id: Date.now() + Math.random()
    };
    
    this.notifications.unshift(notificationWithId);
    
    // Keep only last 50 notifications
    if (this.notifications.length > 50) {
      this.notifications = this.notifications.slice(0, 50);
    }
    
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(notificationWithId);
      } catch (error) {
        console.error('Notification listener error:', error);
      }
    });

    // Auto-remove after duration
    if (notification.duration > 0) {
      setTimeout(() => {
        this.removeNotification(notificationWithId.id);
      }, notification.duration);
    }
  }

  // Remove notification
  removeNotification(id) {
    this.notifications = this.notifications.filter(n => n.id !== id);
    this.listeners.forEach(listener => {
      try {
        listener({ type: 'remove', id });
      } catch (error) {
        console.error('Notification listener error:', error);
      }
    });
  }

  // Subscribe to notifications
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Get current notifications
  getNotifications() {
    return [...this.notifications];
  }

  // Developer-facing event logging
  logDeveloperEvent(eventType, data) {
    const event = {
      type: eventType,
      timestamp: new Date().toISOString(),
      data,
      sessionId: this.getSessionId()
    };

    // Console logging for development
    console.group(`🔧 Developer Event: ${eventType}`);
    console.log('📅 Timestamp:', event.timestamp);
    console.log('📊 Data:', event.data);
    console.log('🔗 Session:', event.sessionId);
    console.groupEnd();

    // Store in localStorage for debugging
    this.storeDeveloperEvent(event);

    // Future: Send to webhook or analytics service
    this.sendToMonitoring(event);
  }

  // Content generation specific logging
  logContentGeneration(data) {
    const {
      topicId,
      topicName,
      sourceIds = [],
      generationType = 'bulk',
      itemsGenerated = 0,
      breakdown = {},
      processingTimeMs = 0,
      generationId = null,
      success = true,
      error = null
    } = data;

    this.logDeveloperEvent('content_generation', {
      topicId,
      topicName,
      sourceIds,
      generationType,
      itemsGenerated,
      breakdown,
      processingTimeMs,
      generationId,
      success,
      error,
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // Show user notification
    if (success) {
      const typeBreakdown = Object.entries(breakdown)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');

      this.showSuccess(
        `✨ AI content generated successfully!`,
        {
          message: `Generated ${itemsGenerated} study items: ${typeBreakdown}`,
          topicName,
          processingTime: `${(processingTimeMs / 1000).toFixed(1)}s`,
          breakdown
        }
      );
    } else {
      this.showError(
        `❌ Content generation failed`,
        {
          message: error || 'Unknown error occurred',
          topicName,
          generationType
        }
      );
    }
  }

  // Source ingestion logging
  logSourceIngestion(data) {
    const {
      topicId,
      topicName,
      sourceType,
      sourceName,
      wordCount = 0,
      fileSize = 0,
      success = true,
      error = null,
      sourceId = null
    } = data;

    this.logDeveloperEvent('source_ingestion', {
      topicId,
      topicName,
      sourceType,
      sourceName,
      wordCount,
      fileSize,
      success,
      error,
      sourceId,
      userAgent: navigator.userAgent
    });

    // Show user notification
    if (success) {
      const sizeText = fileSize > 0 ? `, ${this.formatFileSize(fileSize)}` : '';
      const wordText = wordCount > 0 ? `, ${wordCount} words` : '';
      
      this.showSuccess(
        `📄 ${sourceType === 'youtube' ? 'Video' : 'File'} processed successfully!`,
        {
          message: `${sourceName}${sizeText}${wordText}`,
          topicName,
          sourceType
        }
      );
    } else {
      this.showError(
        `❌ Failed to process ${sourceType === 'youtube' ? 'video' : 'file'}`,
        {
          message: error || 'Unknown error occurred',
          sourceName,
          topicName
        }
      );
    }
  }

  // Helper methods
  getSessionId() {
    if (!this.sessionId) {
      this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    return this.sessionId;
  }

  storeDeveloperEvent(event) {
    try {
      const stored = JSON.parse(localStorage.getItem('dev_events') || '[]');
      stored.unshift(event);
      
      // Keep only last 100 events
      if (stored.length > 100) {
        stored.splice(100);
      }
      
      localStorage.setItem('dev_events', JSON.stringify(stored));
    } catch (error) {
      console.warn('Failed to store developer event:', error);
    }
  }

  sendToMonitoring(event) {
    // Future implementation: send to webhook or analytics
    // For now, just prepare the structure
    const monitoringData = {
      event_type: event.type,
      timestamp: event.timestamp,
      session_id: event.sessionId,
      user_id: this.getCurrentUserId(),
      data: event.data,
      environment: import.meta.env.MODE || 'development'
    };

    // TODO: Implement webhook sending
    // fetch('/api/monitoring/events', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(monitoringData)
    // });
  }

  getCurrentUserId() {
    // This would be set by the auth system
    return this.currentUserId || 'anonymous';
  }

  setCurrentUserId(userId) {
    this.currentUserId = userId;
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get developer events for debugging
  getDeveloperEvents() {
    try {
      return JSON.parse(localStorage.getItem('dev_events') || '[]');
    } catch {
      return [];
    }
  }

  // Clear developer events
  clearDeveloperEvents() {
    localStorage.removeItem('dev_events');
  }
}

// Export singleton instance
export const notificationService = new NotificationService(); 