import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, FileText, Brain, TestTube, BarChart3, Clock, Youtube, AlertCircle } from 'lucide-react';
import * as Tabs from '@radix-ui/react-tabs';
import IngestionTab from './IngestionTab';
import QuestionPoolTab from './QuestionPoolTab';
import StudyTab from './StudyTab';
import TestsTab from './TestsTab';
import ProgressTab from './ProgressTab';
import HistoryTab from './HistoryTab';

function TopicDetail({ topic: initialTopic, onBack, dataService }) {
  const [activeTab, setActiveTab] = useState('ingestion');
  const [topic, setTopic] = useState(initialTopic);
  const [documents, setDocuments] = useState([]);
  const [questionPool, setQuestionPool] = useState([]);
  const [savedQuestions, setSavedQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load full topic details, documents, and questions
    loadTopicData();
  }, [topic.id]);

  const loadTopicData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch full topic details
      const topicData = await dataService.getTopic(topic.id);
      setTopic(topicData);
      
      // Fetch documents
      const docs = await dataService.getDocuments(topic.id);
      setDocuments(docs);
      
      // Fetch questions
      await loadQuestions();
    } catch (err) {
      console.error('Failed to load topic data:', err);
      setError('Failed to load topic details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const pool = await dataService.getQuestions(topic.id);
      const saved = await dataService.getQuestions(topic.id, true);
      setQuestionPool(pool);
      setSavedQuestions(saved);
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
  };

  const handleQuestionSaved = () => {
    loadQuestions();
  };

  const handleUpdate = () => {
    loadTopicData();
  };

  const tabItems = [
    { value: 'ingestion', label: 'Ingestion', icon: Upload },
    { value: 'questions', label: 'Question Pool', icon: FileText },
    { value: 'study', label: 'Study', icon: Brain },
    { value: 'tests', label: 'Tests', icon: TestTube },
    { value: 'progress', label: 'Progress', icon: BarChart3 },
    { value: 'history', label: 'History', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Topic</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onBack}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Back to Dashboard
          </button>
          <button
            onClick={loadTopicData}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>
        <div>
          <h2 className="text-3xl font-bold text-gray-900">{topic.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(topic.created_at).toLocaleDateString()} at {new Date(topic.created_at).toLocaleTimeString()}
          </p>
          {documents.length > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex space-x-1 border-b border-gray-200 mb-6">
          {tabItems.map((item) => {
            const Icon = item.icon;
            return (
              <Tabs.Trigger
                key={item.value}
                value={item.value}
                className={`flex items-center px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === item.value
                    ? 'text-indigo-600 border-indigo-600'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {item.label}
                {item.value === 'questions' && questionPool.length > 0 && (
                  <span className="ml-2 bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full text-xs">
                    {questionPool.length}
                  </span>
                )}
                {item.value === 'study' && savedQuestions.length > 0 && (
                  <span className="ml-2 bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-xs">
                    {savedQuestions.length}
                  </span>
                )}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>

        <Tabs.Content value="ingestion">
          <IngestionTab 
            topic={topic}
            documents={documents}
            onUpdate={handleUpdate}
            dataService={dataService}
          />
        </Tabs.Content>

        <Tabs.Content value="questions">
          <QuestionPoolTab 
            topic={topic} 
            questions={questionPool}
            onQuestionSaved={handleQuestionSaved}
            onUpdate={handleUpdate}
            dataService={dataService}
          />
        </Tabs.Content>

        <Tabs.Content value="study">
          <StudyTab 
            topic={topic} 
            savedQuestions={savedQuestions}
            onUpdate={handleUpdate}
            dataService={dataService}
          />
        </Tabs.Content>

        <Tabs.Content value="tests">
          <TestsTab 
            topic={topic} 
            savedQuestions={savedQuestions}
            onUpdate={handleUpdate}
            dataService={dataService}
          />
        </Tabs.Content>

        <Tabs.Content value="progress">
          <ProgressTab 
            topic={topic}
            dataService={dataService}
          />
        </Tabs.Content>

        <Tabs.Content value="history">
          <HistoryTab 
            topic={topic}
            dataService={dataService}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}

export default TopicDetail; 