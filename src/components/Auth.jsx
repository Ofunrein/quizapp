import React, { useState } from 'react';
import { useData } from '../contexts/DataContext';
import { auth } from '../lib/supabase';
import { X, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

function Auth({ onClose }) {
  const { user } = useData();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('ofunrein123@gmail.com');
  const [password, setPassword] = useState('Ohireme@1234');
  const [confirmPassword, setConfirmPassword] = useState('Ohireme@1234');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          showMessage('Passwords do not match', 'error');
          setLoading(false);
          return;
        }

        console.log('🔧 Attempting to create account for:', email);
        const { data, error } = await auth.signUp(email, password);
        
        if (error) {
          console.error('❌ Sign up error:', error);
          
          if (error.message.includes('already registered')) {
            showMessage('Account already exists! Try signing in instead.', 'info');
            setIsSignUp(false);
          } else {
            showMessage(`Sign up failed: ${error.message}`, 'error');
          }
        } else {
          console.log('✅ Sign up successful:', data);
          if (data.user && !data.session) {
            showMessage('Account created! Check your email to confirm your account.', 'success');
          } else if (data.session) {
            showMessage('Account created and signed in successfully!', 'success');
            setTimeout(() => onClose(), 1000);
          }
        }
      } else {
        console.log('🔑 Attempting to sign in with:', email);
        const { data, error } = await auth.signIn(email, password);
        
        if (error) {
          console.error('❌ Sign in error:', error);
          
          if (error.message.includes('Invalid login credentials')) {
            showMessage('Invalid email or password. Try creating an account first!', 'error');
            setIsSignUp(true);
          } else if (error.message.includes('Email not confirmed')) {
            showMessage('Please check your email and confirm your account first.', 'info');
          } else {
            showMessage(`Sign in failed: ${error.message}`, 'error');
          }
        } else {
          console.log('✅ Sign in successful:', data);
          showMessage('Signed in successfully!', 'success');
          setTimeout(() => onClose(), 1000);
        }
      }
    } catch (err) {
      console.error('❌ Auth error:', err);
      showMessage(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      showMessage('Please enter your email address first', 'error');
      return;
    }

    setLoading(true);
    try {
      const { error } = await auth.resetPasswordForEmail(email);
      if (error) {
        showMessage(`Password reset failed: ${error.message}`, 'error');
      } else {
        showMessage('Password reset email sent! Check your inbox.', 'success');
      }
    } catch (err) {
      showMessage(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>
          <p className="text-gray-600">
            {isSignUp 
              ? 'Create your QuizMaster account to save your progress' 
              : 'Sign in to access your topics and study materials'
            }
          </p>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-md flex items-center gap-2 ${
            messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {messageType === 'error' ? <AlertCircle className="h-4 w-4" /> : 
             messageType === 'success' ? <CheckCircle className="h-4 w-4" /> : 
             <AlertCircle className="h-4 w-4" />}
            <span className="text-sm">{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-4 space-y-3">
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-indigo-600 hover:text-indigo-700 text-sm"
            disabled={loading}
          >
            {isSignUp 
              ? 'Already have an account? Sign in' 
              : "Don't have an account? Create one"
            }
          </button>

          {!isSignUp && (
            <button
              onClick={handlePasswordReset}
              className="w-full text-gray-600 hover:text-gray-700 text-sm"
              disabled={loading}
            >
              Forgot your password?
            </button>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Your credentials: ofunrein123@gmail.com / Ohireme@1234
          </p>
        </div>
      </div>
    </div>
  );
}

export default Auth; 