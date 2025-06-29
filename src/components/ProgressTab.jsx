import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, Clock, Award } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../contexts/DataContext';

function ProgressTab({ topic }) {
  const { dataService } = useData();
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProgressData();
  }, [topic.id]);

  const loadProgressData = async () => {
    setLoading(true);
    try {
      const data = await dataService.getProgress(topic.id);
      setProgressData(data);
    } catch (error) {
      console.error('Failed to load progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!progressData) {
    return (
      <div className="text-center py-12">
        <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No progress data yet</h3>
        <p className="text-gray-600">
          Complete some study sessions or tests to see your progress.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Answered</p>
              <p className="text-2xl font-bold text-gray-900">{progressData.totalAnswered}</p>
            </div>
            <Target className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Accuracy</p>
              <p className="text-2xl font-bold text-green-600">{progressData.accuracy}%</p>
            </div>
            <Award className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Cards Reviewed</p>
              <p className="text-2xl font-bold text-blue-600">{progressData.flashcardsReviewed}</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Due This Week</p>
              <p className="text-2xl font-bold text-orange-600">{progressData.upcomingReviews}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Performance Over Time Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progressData.performanceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="#4F46E5" 
                strokeWidth={2}
                dot={{ fill: '#4F46E5' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Retention Curve Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Flashcard Retention Curve</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={progressData.retentionCurve}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" label={{ value: 'Days', position: 'insideBottom', offset: -5 }} />
              <YAxis domain={[0, 100]} label={{ value: 'Retention %', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Bar dataKey="retention" fill="#10B981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Study Tips */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-3 text-blue-900">Study Tips</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Review flashcards daily to improve retention</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Take practice tests regularly to identify weak areas</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Focus on questions you got wrong in previous attempts</span>
          </li>
          <li className="flex items-start">
            <span className="mr-2">•</span>
            <span>Use spaced repetition for optimal memory retention</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export default ProgressTab; 