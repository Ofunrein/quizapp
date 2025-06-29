import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Brain, Upload, TestTube, BarChart3, ArrowRight } from 'lucide-react';
import { useData } from '../contexts/DataContext';

function Home() {
  const navigate = useNavigate();
  const { user } = useData();

  console.log('[DEBUG] Home component rendering:', { hasUser: !!user });

  const handleGetStarted = () => {
    if (user) {
      navigate('/dashboard');
    } else {
      // Scroll to sign-in section or show auth modal
      navigate('/dashboard'); // This will show the auth requirement
    }
  };

  const features = [
    {
      icon: Upload,
      title: 'Upload Content',
      description: 'Upload documents, PDFs, or YouTube videos to create your knowledge base'
    },
    {
      icon: Brain,
      title: 'AI Generation',
      description: 'Our AI analyzes your content and generates personalized study materials'
    },
    {
      icon: TestTube,
      title: 'Practice Tests',
      description: 'Take timed practice tests to assess your knowledge and track progress'
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Monitor your learning progress with detailed analytics and insights'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="text-center">
          <div className="flex justify-center mb-8">
            <BookOpen className="h-20 w-20 text-indigo-600" />
          </div>
          
          <h1 className="text-5xl font-extrabold text-gray-900 mb-6">
            Welcome to <span className="text-indigo-600">QuizMaster</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform any content into personalized study materials with AI-powered learning. 
            Upload your documents, let our AI create flashcards and quizzes, then master your subjects faster than ever.
          </p>
          
                      {!user && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
              <p className="text-blue-800 text-sm">
                📝 <strong>Sign in required:</strong> Create an account to save your topics, upload files, and track your progress across devices.
              </p>
            </div>
          )}
          
                      <button
              onClick={handleGetStarted}
              className="inline-flex items-center px-8 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-lg hover:shadow-xl"
            >
              {user ? 'Go to Dashboard' : 'Get Started'}
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            How QuizMaster Works
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Our AI-powered platform makes studying more effective by creating personalized learning materials from your own content.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-lg mb-4">
                  <Icon className="h-6 w-6 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-indigo-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Join thousands of students and professionals who are already using QuizMaster to accelerate their learning.
          </p>
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center px-8 py-4 bg-white text-indigo-600 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-lg"
          >
            Start Learning Now
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default Home; 