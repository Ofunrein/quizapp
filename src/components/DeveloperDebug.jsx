import React, { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { 
  Copy, 
  CheckCircle, 
  Minimize2, 
  Maximize2, 
  X, 
  RefreshCw, 
  Trash2, 
  Shield, 
  Settings, 
  ChevronDown,
  Brain,
  FileText
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const DeveloperDebug = () => {
  const [events, setEvents] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [filter, setFilter] = useState('all');
  const [copiedStates, setCopiedStates] = useState({});
  const [allEventsCopied, setAllEventsCopied] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = () => {
    const allEvents = notificationService.getDeveloperEvents();
    setEvents(allEvents);
  };

  const clearEvents = () => {
    notificationService.clearDeveloperEvents();
    setEvents([]);
  };

  const copyEventToClipboard = async (event, index) => {
    try {
      const eventText = formatEventForClipboard(event);
      await navigator.clipboard.writeText(eventText);
      
      setCopiedStates(prev => ({ ...prev, [index]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [index]: false }));
      }, 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const copyAllEventsToClipboard = async () => {
    try {
      const allEventsText = filteredEvents.map(event => formatEventForClipboard(event)).join('\n\n---\n\n');
      await navigator.clipboard.writeText(allEventsText);
      
      setAllEventsCopied(true);
      setTimeout(() => {
        setAllEventsCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy all events to clipboard:', error);
    }
  };

  const formatEventForClipboard = (event) => {
    const lines = [
      `${event.type.toUpperCase().replace('_', ' ')}`,
      `${formatTimestamp(event.timestamp)}`,
    ];

    if (event.data.topicName) lines.push(`Topic: ${event.data.topicName}`);
    if (event.data.sourceName) lines.push(`Source: ${event.data.sourceName}`);
    
    const status = event.data.success !== undefined ? 
      (event.data.success ? 'SUCCESS' : 'FAILED') : 'UNKNOWN';
    lines.push(`Status: ${status}`);
    
    if (event.data.error) lines.push(`Error: ${event.data.error}`);
    if (event.data.itemsGenerated) lines.push(`Generated: ${event.data.itemsGenerated} items`);
    if (event.data.wordCount) lines.push(`Words: ${event.data.wordCount.toLocaleString()}`);
    if (event.data.processingTimeMs) lines.push(`Time: ${(event.data.processingTimeMs / 1000).toFixed(2)}s`);
    
    if (event.data.breakdown) {
      const breakdownText = Object.entries(event.data.breakdown)
        .filter(([_, count]) => count > 0)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      if (breakdownText) lines.push(`Breakdown: ${breakdownText}`);
    }

    return lines.join('\n');
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    return event.type === filter;
  });

  const getEventIcon = (type) => {
    switch (type) {
      case 'content_generation':
        return '🤖';
      case 'source_ingestion':
        return '📄';
      default:
        return '🔧';
    }
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'content_generation':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'source_ingestion':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const testAuthentication = async () => {
    const event = {
      timestamp: new Date().toISOString(),
      type: 'AUTH_TEST',
      data: {}
    };
    
    try {
      // Test 1: Get current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      event.data.session = session ? { 
        user: { id: session.user.id, email: session.user.email },
        expires_at: session.expires_at 
      } : null;
      event.data.sessionError = sessionError;
      
      // Test 2: Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      event.data.user = user ? { id: user.id, email: user.email } : null;
      event.data.userError = userError;
      
      // Test 3: Try a simple query
      const { data: topics, error: topicsError } = await supabase
        .from('topics')
        .select('id, name')
        .limit(1);
      event.data.canQueryTopics = !topicsError;
      event.data.topicsError = topicsError;
      
      // Test 4: Check auth function
      const { data: authCheck, error: authError } = await supabase
        .rpc('check_auth_context');
      event.data.authContext = authCheck;
      event.data.authContextError = authError;
      
      // Update event status
      event.data.success = !!user;
      event.data.error = user ? null : 'Not authenticated - please sign in';
      event.data.topicName = 'Authentication Test';
      event.data.sourceName = user ? user.email : 'No user';
      
      // Add to events
      notificationService.logDeveloperEvent(event.type, event.data);
      loadEvents(); // Refresh the events list
      
    } catch (error) {
      event.data.success = false;
      event.data.error = error.message;
      event.data.topicName = 'Authentication Test';
      event.data.sourceName = 'Error';
      notificationService.logDeveloperEvent(event.type, event.data);
      loadEvents();
    }
  };

  if (!isOpen || isMinimized) {
    return (
      <button
        onClick={() => {
          setIsOpen(true);
          setIsMinimized(false);
        }}
        className="fixed bottom-4 left-4 z-40 bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700 transition-colors"
        title="Developer Debug Console"
      >
        🔧
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 z-40 w-[28rem] max-h-96 bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg">🔧</span>
          <h3 className="font-semibold text-sm">Developer Console</h3>
          <span className="text-xs bg-gray-700 px-2 py-1 rounded">
            {filteredEvents.length} events
          </span>
        </div>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-1.5">
            <button
              onClick={testAuthentication}
              className="text-xs px-2.5 py-1.5 rounded-md transition-all duration-200 flex items-center space-x-1 bg-purple-600 hover:bg-purple-700 text-white font-medium shadow-sm hover:shadow-md"
              title="Test Authentication"
            >
              <span className="text-sm">🔐</span>
              <span>Auth</span>
            </button>
            <button
              onClick={copyAllEventsToClipboard}
              className={`text-xs px-2.5 py-1.5 rounded-md transition-all duration-200 flex items-center space-x-1 font-medium shadow-sm hover:shadow-md ${
                allEventsCopied 
                  ? 'bg-green-600 hover:bg-green-700 text-white' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
              title="Copy all events to clipboard"
            >
              {allEventsCopied ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              <span>{allEventsCopied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={loadEvents}
              className="text-xs bg-gray-600 hover:bg-gray-700 px-2.5 py-1.5 rounded-md transition-all duration-200 text-white font-medium shadow-sm hover:shadow-md flex items-center"
              title="Refresh events"
            >
              <span className="text-sm">🔄</span>
            </button>
            <button
              onClick={clearEvents}
              className="text-xs bg-red-600 hover:bg-red-700 px-2.5 py-1.5 rounded-md transition-all duration-200 text-white font-medium shadow-sm hover:shadow-md flex items-center"
              title="Clear events"
            >
              <span className="text-sm">🗑️</span>
            </button>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="text-white bg-slate-600 hover:bg-slate-700 transition-all duration-200 text-xs px-2 py-1.5 rounded-md font-medium shadow-sm hover:shadow-md flex items-center justify-center min-w-[2rem]"
              title="Minimize Console"
            >
              <span className="text-sm leading-none">▼</span>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-300 hover:text-white hover:bg-gray-700 transition-all duration-200 text-sm px-2 py-1.5 rounded-md flex items-center justify-center min-w-[2rem]"
              title="Close Console"
            >
              <span className="text-lg leading-none">✕</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="p-2 border-b border-gray-200 bg-gray-50">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-xs w-full border border-gray-300 rounded px-2 py-1"
        >
          <option value="all">All Events</option>
          <option value="content_generation">Content Generation</option>
          <option value="source_ingestion">Source Ingestion</option>
        </select>
      </div>

      {/* Events List */}
      <div className="max-h-80 overflow-y-auto">
      {filteredEvents.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">
          No events logged yet
        </div>
      ) : (
        filteredEvents.map((event, index) => (
          <div
            key={index}
            className={`p-3 border-b border-gray-100 last:border-b-0 ${getEventColor(event.type)}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm">{getEventIcon(event.type)}</span>
                <span className="font-medium text-xs uppercase tracking-wide">
                  {event.type.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => copyEventToClipboard(event, index)}
                  className={`text-xs px-2.5 py-1 rounded-md transition-all duration-200 flex items-center shadow-sm hover:shadow-md font-medium ${
                    copiedStates[index] 
                      ? 'bg-green-600 hover:bg-green-700 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800'
                  }`}
                  title="Copy event to clipboard"
                >
                  {copiedStates[index] ? (
                    <CheckCircle className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <span className="text-xs opacity-70">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
            </div>

            <div className="text-xs space-y-1">
              {event.data.topicName && (
                <div>
                  <strong>Topic:</strong> {event.data.topicName}
                </div>
              )}
              
              {event.data.sourceName && (
                <div>
                  <strong>Source:</strong> {event.data.sourceName}
                </div>
              )}

              {event.data.success !== undefined && (
                <div className={`font-medium ${event.data.success ? 'text-green-600' : 'text-red-600'}`}>
                  <strong>Status:</strong> {event.data.success ? 'SUCCESS' : 'FAILED'}
                </div>
              )}

              {event.data.error && (
                <div className="text-red-600">
                  <strong>Error:</strong> {event.data.error}
                </div>
              )}

              {event.data.itemsGenerated && (
                <div>
                  <strong>Generated:</strong> {event.data.itemsGenerated} items
                </div>
              )}

              {event.data.breakdown && (
                <div className="text-xs">
                  <strong>Breakdown:</strong> {
                    Object.entries(event.data.breakdown)
                      .filter(([_, count]) => count > 0)
                      .map(([type, count]) => `${count} ${type}`)
                      .join(', ')
                  }
                </div>
              )}

              {event.data.wordCount && (
                <div>
                  <strong>Words:</strong> {event.data.wordCount.toLocaleString()}
                </div>
              )}

              {event.data.processingTimeMs && (
                <div>
                  <strong>Time:</strong> {(event.data.processingTimeMs / 1000).toFixed(2)}s
                </div>
              )}

              {event.data.sourceIds && event.data.sourceIds.length > 0 && (
                <div>
                  <strong>Sources:</strong> {event.data.sourceIds.length} source(s)
                </div>
              )}

              {event.data.generationId && (
                <div className="text-xs opacity-70">
                  <strong>Generation ID:</strong> {event.data.generationId.slice(0, 8)}...
                </div>
              )}
            </div>
          </div>
        ))
      )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
        Session: {notificationService.getSessionId().slice(-8)}
      </div>
    </div>
  );
};

export default DeveloperDebug; 