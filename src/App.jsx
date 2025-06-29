import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { DataProvider, useData } from './contexts/DataContext';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import TopicDetail from './components/TopicDetail';
import Auth from './components/Auth';
import NotificationToast from './components/NotificationToast';
import DeveloperDebug from './components/DeveloperDebug';
import { BookOpen, LogOut } from 'lucide-react';
import { notificationService } from './services/notificationService';

function Header() {
  const { user, signOut } = useData();
  const [showAuth, setShowAuth] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (showAuth) {
    return (
      <>
        <Auth onClose={() => setShowAuth(false)} />
        <button
          onClick={() => setShowAuth(false)}
          className="fixed bottom-4 right-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors z-50"
        >
          Continue without account
        </button>
      </>
    );
  }

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
              <BookOpen className="h-8 w-8 text-indigo-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">QuizMaster</h1>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">{user.email}</span>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function DashboardPage() {
  const navigate = useNavigate();
  
  const handleSelectTopic = (topic) => {
    navigate(`/topic/${topic.id}`, { state: { topic } });
  };

  return <Dashboard onSelectTopic={handleSelectTopic} />;
}

function TopicPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dataService } = useData();
  
  const topic = location.state?.topic;
  
  const handleBack = () => {
    navigate('/dashboard');
  };

  // Use useEffect to handle navigation to avoid rendering during render
  React.useEffect(() => {
    if (!topic) {
      navigate('/dashboard', { replace: true });
    }
  }, [topic, navigate]);

  if (!topic) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <TopicDetail
      topic={topic}
      onBack={handleBack}
      dataService={dataService}
    />
  );
}

function AppContent() {
  const { loading, user } = useData();

  console.log('[DEBUG] AppContent render:', { loading, hasUser: !!user });

  // Set user ID for notification service when user changes
  useEffect(() => {
    console.log('[DEBUG] AppContent useEffect - user changed:', { hasUser: !!user, userId: user?.id });
    if (user) {
      notificationService.setCurrentUserId(user.id);
    } else {
      notificationService.setCurrentUserId(null);
    }
  }, [user]);

  // TEMPORARY: Force show app after 3 seconds if still loading
  const [forceShow, setForceShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) {
        console.log('[DEBUG] FORCING APP TO SHOW - loading took too long');
        setForceShow(true);
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading && !forceShow) {
    console.log('[DEBUG] AppContent showing loading spinner');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  console.log('[DEBUG] AppContent rendering main app with routes');
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <DashboardPage />
          </main>
        } />
        <Route path="/topic/:id" element={
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TopicPage />
          </main>
        } />
        {/* Catch all route - redirect to home */}
        <Route path="*" element={<Home />} />
      </Routes>

      {/* Global notification system */}
      <NotificationToast />
      
      {/* Developer debug console (only in development) */}
      {import.meta.env.DEV && <DeveloperDebug />}
    </div>
  );
}

function App() {
  console.log('[DEBUG] App component rendering');
  
  return (
    <Router>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </Router>
  );
}

export default App; 