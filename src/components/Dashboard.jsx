import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, BookOpen, Clock, FileText, AlertCircle, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';

function Dashboard({ onSelectTopic }) {
  const { dataService, user } = useData();
  const navigate = useNavigate();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [editingTopic, setEditingTopic] = useState(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Fetch topics on mount
  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setError('Please sign in to access your topics.');
        return;
      }
      
      const data = await dataService.getTopics();
      setTopics(data);
    } catch (err) {
      console.error('Failed to fetch topics:', err);
      if (err.message.includes('Authentication required')) {
        setError('Please sign in to access your topics.');
      } else {
        setError('Failed to load topics. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (newTopicName.trim() && !isCreating) {
      setIsCreating(true);
      try {
        const newTopic = await dataService.createTopic(newTopicName.trim());
        setTopics([newTopic, ...topics]);
        setNewTopicName('');
        setShowCreateModal(false);
      } catch (err) {
        console.error('Failed to create topic:', err);
        alert('Failed to create topic. Please try again.');
      } finally {
        setIsCreating(false);
      }
    }
  };

  const handleEditTopic = (topic) => {
    setEditingTopic(topic.id);
    setEditName(topic.name);
  };

  const handleSaveEdit = async (topicId) => {
    if (editName.trim()) {
      try {
        const updatedTopic = await dataService.updateTopic(topicId, { name: editName.trim() });
        setTopics(topics.map(t => t.id === topicId ? updatedTopic : t));
        setEditingTopic(null);
        setEditName('');
      } catch (err) {
        console.error('Failed to update topic:', err);
        alert('Failed to update topic. Please try again.');
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingTopic(null);
    setEditName('');
  };

  const handleDeleteTopic = async (id) => {
    if (window.confirm('Are you sure you want to delete this topic?')) {
      try {
        await dataService.deleteTopic(id);
        setTopics(topics.filter(t => t.id !== id));
      } catch (err) {
        console.error('Failed to delete topic:', err);
        alert('Failed to delete topic. Please try again.');
      }
    }
  };

  const getDocumentCount = async (topicId) => {
    try {
      const docs = await dataService.getKnowledgeBase(topicId);
      return docs.length;
    } catch {
      return 0;
    }
  };

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
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Topics</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={fetchTopics}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Home className="h-4 w-4 mr-2" />
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Your Topics</h2>
        <p className="text-gray-600">Create and manage your learning topics</p>
      </div>

      {/* Create Topic Button */}
      <div className="mb-6">
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create New Topic
        </button>
      </div>

      {/* Topics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topics.map((topic) => (
          <div
            key={topic.id}
            className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => editingTopic !== topic.id && onSelectTopic(topic)}
          >
            <div className="p-6">
              {editingTopic === topic.id ? (
                <div className="mb-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit(topic.id)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(topic.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <BookOpen className="h-8 w-8 text-indigo-600 mr-3" />
                      <h3 className="text-xl font-semibold text-gray-900">{topic.name}</h3>
                    </div>
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleEditTopic(topic)}
                        className="p-1 text-gray-500 hover:text-indigo-600 transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTopic(topic.id)}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      <span>Loading documents...</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      <span>Created {new Date(topic.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {topics.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No topics yet</h3>
          <p className="text-gray-600">Create your first topic to get started</p>
        </div>
      )}

      {/* Create Topic Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Create New Topic</h3>
            <form onSubmit={handleCreateTopic}>
              <input
                type="text"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                placeholder="Enter topic name"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
                autoFocus
                disabled={isCreating}
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewTopicName('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard; 