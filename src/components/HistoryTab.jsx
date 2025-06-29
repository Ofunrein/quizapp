import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  FileText, 
  Youtube, 
  Code, 
  Image, 
  Brain, 
  Calendar,
  Users,
  BarChart3,
  Eye,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileCheck
} from 'lucide-react';
import { formatFileSize } from '../utils/formatFileSize';

function HistoryTab({ topic, dataService }) {
  const [history, setHistory] = useState([]);
  const [detailedGenerations, setDetailedGenerations] = useState([]);
  const [sourcesWithStats, setSourcesWithStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGenerations, setExpandedGenerations] = useState(new Set());
  const [selectedView, setSelectedView] = useState('timeline'); // 'timeline', 'sources', 'generations'

  useEffect(() => {
    if (topic?.id) {
      loadHistoryData();
    }
  }, [topic?.id]);

  const loadHistoryData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all history data in parallel
      const [historyData, generationsData, sourcesData] = await Promise.all([
        dataService.getTopicHistory(topic.id),
        dataService.getGenerationHistory(topic.id),
        dataService.getSourcesWithStats(topic.id)
      ]);

      setHistory(historyData);
      setDetailedGenerations(generationsData);
      setSourcesWithStats(sourcesData);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError('Failed to load history data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getSourceIcon = (sourceType, metadata) => {
    switch (sourceType) {
      case 'youtube':
        return <Youtube className="h-5 w-5 text-red-600" />;
      case 'file':
        if (metadata?.isCodeFile) return <Code className="h-5 w-5 text-green-600" />;
        if (metadata?.processedWithOCR) return <Image className="h-5 w-5 text-purple-600" />;
        if (metadata?.fileType?.includes('pdf')) return <FileCheck className="h-5 w-5 text-red-600" />;
        return <FileText className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-400" />;
    }
  };

  const getItemTypeIcon = (itemType) => {
    switch (itemType) {
      case 'flashcard':
        return '📚';
      case 'multiple-choice':
        return '❓';
      case 'open-ended':
        return '✍️';
      case 'summary':
        return '📝';
      default:
        return '📋';
    }
  };

  const toggleGenerationExpansion = (generationId) => {
    const newExpanded = new Set(expandedGenerations);
    if (newExpanded.has(generationId)) {
      newExpanded.delete(generationId);
    } else {
      newExpanded.add(generationId);
    }
    setExpandedGenerations(newExpanded);
  };

  const renderTimelineView = () => (
    <div className="space-y-6">
      {history.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No History Yet</h3>
          <p className="text-gray-600">Upload some content or generate study materials to see your topic's history.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          
          {history.map((entry, index) => {
            const { date, time } = formatDate(entry.timestamp);
            const isSource = entry.entry_type === 'source';
            
            return (
              <div key={entry.entry_id} className="relative flex items-start space-x-4 pb-8">
                {/* Timeline dot */}
                <div className={`relative z-10 flex items-center justify-center w-16 h-16 rounded-full border-4 border-white shadow-lg ${
                  isSource ? 'bg-blue-500' : 'bg-indigo-600'
                }`}>
                  {isSource ? (
                    getSourceIcon(entry.type, entry.metadata)
                  ) : (
                    <Brain className="h-6 w-6 text-white" />
                  )}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="bg-white rounded-lg shadow border p-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {entry.title}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 mr-1" />
                        {date} at {time}
                      </div>
                    </div>
                    
                    {isSource ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {entry.type === 'youtube' ? 'YouTube Video' : 'File Upload'}
                          </span>
                          {entry.word_count && (
                            <span>📝 {entry.word_count.toLocaleString()} words</span>
                          )}
                          {entry.metadata?.pages && (
                            <span>📄 {entry.metadata.pages} pages</span>
                          )}
                          {entry.metadata?.duration && (
                            <span>⏱️ {Math.floor(entry.metadata.duration / 60)} min</span>
                          )}
                        </div>
                        
                        {entry.metadata?.language && (
                          <div className="text-sm text-gray-600">
                            💻 Programming Language: <span className="font-medium">{entry.metadata.language}</span>
                          </div>
                        )}
                        
                        {entry.metadata?.hasTranscript === false && (
                          <div className="text-sm text-amber-600 bg-amber-50 p-2 rounded">
                            ⚠️ No transcript available - manual notes were added
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            AI Generation
                          </span>
                          <span>🎯 {entry.items_count} items created</span>
                        </div>
                        
                        {entry.metadata && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                            {entry.metadata.flashcards && (
                              <div className="bg-blue-50 p-2 rounded text-center">
                                <div className="font-medium text-blue-800">📚 {entry.metadata.flashcards}</div>
                                <div className="text-blue-600 text-xs">Flashcards</div>
                              </div>
                            )}
                            {entry.metadata.multipleChoice && (
                              <div className="bg-green-50 p-2 rounded text-center">
                                <div className="font-medium text-green-800">❓ {entry.metadata.multipleChoice}</div>
                                <div className="text-green-600 text-xs">Multiple Choice</div>
                              </div>
                            )}
                            {entry.metadata.openEnded && (
                              <div className="bg-purple-50 p-2 rounded text-center">
                                <div className="font-medium text-purple-800">✍️ {entry.metadata.openEnded}</div>
                                <div className="text-purple-600 text-xs">Open-Ended</div>
                              </div>
                            )}
                            {entry.metadata.summaries && (
                              <div className="bg-orange-50 p-2 rounded text-center">
                                <div className="font-medium text-orange-800">📝 {entry.metadata.summaries}</div>
                                <div className="text-orange-600 text-xs">Summaries</div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-600">
                          📊 Generated from {entry.source_ids?.length || 0} source(s)
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderSourcesView = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">📋 Sources Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-blue-800">{sourcesWithStats.length}</div>
            <div className="text-blue-600 text-sm">Total Sources</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-800">
              {sourcesWithStats.reduce((sum, s) => sum + (s.word_count || 0), 0).toLocaleString()}
            </div>
            <div className="text-green-600 text-sm">Total Words</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg text-center">
            <div className="text-2xl font-bold text-purple-800">
              {sourcesWithStats.reduce((sum, s) => sum + s.generatedItemsCount, 0)}
            </div>
            <div className="text-purple-600 text-sm">Generated Items</div>
          </div>
        </div>
      </div>

      {sourcesWithStats.map((source) => {
        const { date, time } = formatDate(source.ingested_at);
        
        return (
          <div key={source.id} className="bg-white rounded-lg shadow border p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {getSourceIcon(source.source_type, source.metadata)}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-medium text-gray-900 truncate">
                    {source.original_name || source.source_name}
                  </h4>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {source.source_type === 'youtube' ? 'YouTube' : 'File'}
                    </span>
                    <span>📅 {date} at {time}</span>
                    {source.word_count && <span>📝 {source.word_count.toLocaleString()} words</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-semibold text-indigo-600">
                  {source.generatedItemsCount}
                </div>
                <div className="text-sm text-gray-500">Generated Items</div>
              </div>
            </div>
            
            {source.metadata && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {source.metadata.fileType && (
                  <div>
                    <span className="text-gray-500">Type:</span>
                    <span className="ml-1 font-medium">{source.metadata.fileType}</span>
                  </div>
                )}
                {source.metadata.language && (
                  <div>
                    <span className="text-gray-500">Language:</span>
                    <span className="ml-1 font-medium">{source.metadata.language}</span>
                  </div>
                )}
                {source.metadata.pages && (
                  <div>
                    <span className="text-gray-500">Pages:</span>
                    <span className="ml-1 font-medium">{source.metadata.pages}</span>
                  </div>
                )}
                {source.file_size && (
                  <div>
                    <span className="text-gray-500">Size:</span>
                    <span className="ml-1 font-medium">{formatFileSize(source.file_size)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderGenerationsView = () => (
    <div className="space-y-4">
      {detailedGenerations.length === 0 ? (
        <div className="text-center py-12">
          <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No AI Generations Yet</h3>
          <p className="text-gray-600">Generate study materials to see AI generation history.</p>
        </div>
      ) : (
        detailedGenerations.map((generation) => {
          const { date, time } = formatDate(generation.completed_at);
          const isExpanded = expandedGenerations.has(generation.id);
          
          return (
            <div key={generation.id} className="bg-white rounded-lg shadow border">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Brain className="h-8 w-8 text-indigo-600" />
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        AI Generation - {generation.items_generated} items
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>📅 {date} at {time}</span>
                        <span>⚡ {generation.processing_time_ms}ms</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          generation.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {generation.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleGenerationExpansion(generation.id)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {isExpanded ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>
                
                {generation.breakdown && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(generation.breakdown).map(([type, count]) => (
                      <div key={type} className="bg-gray-50 p-3 rounded text-center">
                        <div className="font-medium text-gray-900">{getItemTypeIcon(type)} {count}</div>
                        <div className="text-gray-600 text-xs capitalize">{type.replace(/([A-Z])/g, ' $1').trim()}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {isExpanded && generation.generation_items && (
                <div className="border-t bg-gray-50 p-6">
                  <h4 className="text-md font-medium text-gray-900 mb-4">Generated Items</h4>
                  <div className="space-y-3">
                    {generation.generation_items.map((item) => (
                      <div key={item.id} className="bg-white p-4 rounded border">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-lg">{getItemTypeIcon(item.item_type)}</span>
                              <span className="font-medium text-gray-900">{item.item_title}</span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                item.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                                item.difficulty === 'hard' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {item.difficulty}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600">
                              Derived from {item.derived_from_sources?.length || 0} source(s)
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            {item.questions?.is_saved && (
                              <span className="text-green-600">✓ Saved</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600">Loading history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading History</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadHistoryData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">📚 Topic History</h2>
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setSelectedView('timeline')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'timeline' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Timeline
            </button>
            <button
              onClick={() => setSelectedView('sources')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'sources' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Sources
            </button>
            <button
              onClick={() => setSelectedView('generations')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedView === 'generations' 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Brain className="h-4 w-4 inline mr-2" />
              AI Generations
            </button>
          </div>
        </div>
        
        <p className="text-gray-600">
          Track all content ingestion and AI generation activity for <strong>{topic?.name}</strong>. 
          View chronological timeline, source details, or AI generation history.
        </p>
      </div>

      {/* Content based on selected view */}
      {selectedView === 'timeline' && renderTimelineView()}
      {selectedView === 'sources' && renderSourcesView()}
      {selectedView === 'generations' && renderGenerationsView()}
    </div>
  );
}

export default HistoryTab; 