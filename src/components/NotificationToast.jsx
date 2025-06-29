import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';

const NotificationToast = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Subscribe to notifications
    const unsubscribe = notificationService.subscribe((notification) => {
      if (notification.type === 'remove') {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      } else {
        setNotifications(prev => {
          // Avoid duplicates
          const exists = prev.find(n => n.id === notification.id);
          if (exists) return prev;
          return [notification, ...prev.slice(0, 4)]; // Keep max 5 notifications
        });
      }
    });

    // Load existing notifications
    setNotifications(notificationService.getNotifications().slice(0, 5));

    return unsubscribe;
  }, []);

  const removeNotification = (id) => {
    notificationService.removeNotification(id);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      default:
        return '📢';
    }
  };

  const getStyles = (type) => {
    const baseStyles = "mb-3 p-4 rounded-lg shadow-lg border-l-4 backdrop-blur-sm transition-all duration-300 ease-in-out transform";
    
    switch (type) {
      case 'success':
        return `${baseStyles} bg-green-50 border-green-500 text-green-800`;
      case 'error':
        return `${baseStyles} bg-red-50 border-red-500 text-red-800`;
      case 'info':
        return `${baseStyles} bg-blue-50 border-blue-500 text-blue-800`;
      default:
        return `${baseStyles} bg-gray-50 border-gray-500 text-gray-800`;
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 max-w-full">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={getStyles(notification.type)}
          style={{
            animation: 'slideInRight 0.3s ease-out'
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className="text-xl flex-shrink-0 mt-0.5">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm mb-1">
                  {notification.message}
                </div>
                {notification.details?.message && (
                  <div className="text-xs opacity-80 mb-2">
                    {notification.details.message}
                  </div>
                )}
                {notification.details?.topicName && (
                  <div className="text-xs opacity-70">
                    Topic: {notification.details.topicName}
                  </div>
                )}
                {notification.details?.processingTime && (
                  <div className="text-xs opacity-70">
                    Processing time: {notification.details.processingTime}
                  </div>
                )}
                {notification.details?.breakdown && (
                  <div className="text-xs opacity-70 mt-1">
                    {Object.entries(notification.details.breakdown)
                      .filter(([_, count]) => count > 0)
                      .map(([type, count]) => (
                        <span key={type} className="inline-block mr-2">
                          {count} {type ? type.replace(/([A-Z])/g, ' $1').toLowerCase() : 'items'}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => removeNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
              aria-label="Close notification"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ))}
      
      <style jsx>{`
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default NotificationToast; 