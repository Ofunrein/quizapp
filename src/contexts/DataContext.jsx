import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, supabase } from '../lib/supabase';
import { supabaseService } from '../services/supabaseService';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export function DataProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[DEBUG] DataProvider useEffect starting');
    
    // Check if Supabase is configured
    if (!supabase) {
      console.error('Supabase not configured. Please check your environment variables.');
      setLoading(false);
      return;
    }

    console.log('[DEBUG] Supabase is configured, getting initial session');

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('[DEBUG] Calling supabase.auth.getSession()');
        
        // Add timeout to prevent hanging
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Session timeout')), 5000)
        );
        
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        console.log('[DEBUG] Session retrieved:', { hasSession: !!session, hasUser: !!session?.user });
        setUser(session?.user || null);
      } catch (error) {
        console.error('Error getting session:', error);
        console.log('[DEBUG] Authentication failed, continuing without user');
        setUser(null);
      } finally {
        console.log('[DEBUG] Setting loading to false');
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    console.log('[DEBUG] Setting up auth state change listener');
    try {
      const { data: { subscription } } = auth.onAuthStateChange((_event, session) => {
        console.log('[DEBUG] Auth state changed:', { event: _event, hasSession: !!session, hasUser: !!session?.user });
        setUser(session?.user || null);
        setLoading(false);
      });

      return () => {
        console.log('[DEBUG] Cleaning up auth subscription');
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('[DEBUG] Failed to set up auth listener:', error);
      setLoading(false);
    }
  }, []);

  // Data service that requires authentication for all operations
  const dataService = {
    // Topics
    async getTopics() {
      if (!user) {
        throw new Error('Authentication required. Please sign in to access your topics.');
      }
      return await supabaseService.getTopics();
    },

    async createTopic(name) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to create topics.');
      }
      return await supabaseService.createTopic(name);
    },

    async updateTopic(id, updates) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to update topics.');
      }
      return await supabaseService.updateTopic(id, updates);
    },

    async deleteTopic(id) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to delete topics.');
      }
      return await supabaseService.deleteTopic(id);
    },

    async getTopic(id) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to access topic details.');
      }
      return await supabaseService.getTopic(id);
    },

    // File upload and document management
    async uploadFile(topicId, file) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to upload files.');
      }
      return await supabaseService.uploadFile(topicId, file);
    },

    async getDocuments(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view documents.');
      }
      return await supabaseService.getDocuments(topicId);
    },

    async deleteDocument(documentId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to delete documents.');
      }
      return await supabaseService.deleteDocument(documentId);
    },

    async updateDocument(documentId, updates) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to update documents.');
      }
      return await supabaseService.updateDocument(documentId, updates);
    },

    async getFileUrl(storagePath) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to access files.');
      }
      return await supabaseService.getFileUrl(storagePath);
    },

    // ENHANCED: Content ingestion with comprehensive file processing
    async ingest({ topicId, file, url, contentText, sourceName }) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to ingest content.');
      }

      console.log('[DEBUG] Starting ingestion with:', {
        topicId,
        hasFile: !!file,
        hasUrl: !!url,
        hasContentText: !!contentText,
        sourceName,
        userId: user.id
      });

      try {
        let result;
        
        if (file) {
          console.log('[DEBUG] Processing file upload:', {
            name: file.name,
            type: file.type,
            size: file.size
          });
          // Handle file upload with comprehensive processing (PDF, OCR, Code, etc.)
          result = await supabaseService.processFileUpload(topicId, file);
        } else if (url) {
          console.log('[DEBUG] Processing YouTube URL:', url);
          // Handle YouTube URL with real transcript extraction
          result = await supabaseService.processYouTubeURL(topicId, url);
        } else if (contentText) {
          console.log('[DEBUG] Processing text content:', {
            textLength: contentText.length,
            sourceName: sourceName || 'Pasted Text'
          });
          // Handle plain text content without file upload
          result = await supabaseService.processTextContent(topicId, contentText, sourceName || 'Pasted Text');
        } else {
          throw new Error('No file, URL, or text content provided');
        }

        console.log('[DEBUG] Ingestion successful:', {
          success: result.success,
          documentId: result.documentId,
          sourceId: result.sourceId,
          wordCount: result.wordCount
        });

        return result;
      } catch (error) {
        console.error('[ERROR] Ingestion failed:', {
          error: error.message || 'Unknown error',
          stack: error.stack,
          topicId,
          userId: user.id,
          errorName: error.name,
          hasFile: !!file,
          hasUrl: !!url,
          hasContentText: !!contentText
        });
        
        // Provide better error message
        const errorMessage = error.message || 'Unknown processing error occurred';
        
        // Re-throw with more context
        throw new Error(`Failed to process content: ${errorMessage}`);
      }
    },

    // NEW: Process web URL and generate AI content instantly
    async ingestWebURL({ topicId, url }) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to process web content.');
      }

      return await supabaseService.processWebURL(topicId, url);
    },

    // NEW: Process direct text input and generate AI content instantly
    async ingestDirectText({ topicId, textContent, promptTitle }) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to process text content.');
      }

      return await supabaseService.processDirectTextInput(topicId, textContent, promptTitle);
    },

    // Knowledge base
    async getKnowledgeBase(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to access knowledge base.');
      }
      return await supabaseService.getKnowledgeBase(topicId);
    },

    // ENHANCED: AI content generation with comprehensive GPT-4 processing
    async generate({ topicId }) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to generate content.');
      }

      return await supabaseService.generateAIContent(topicId);
    },

    // NEW: Generate content from specific sources (appends to existing questions)
    async generateFromSources({ topicId, sourceIds }) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to generate content.');
      }

      return await supabaseService.generateAIContentFromSources(topicId, sourceIds);
    },

    // Questions
    async getQuestions(topicId, savedOnly = false) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to access questions.');
      }
      return await supabaseService.getQuestions(topicId, savedOnly);
    },

    async saveQuestion(topicId, questionId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to save questions.');
      }
      return await supabaseService.saveQuestion(questionId);
    },

    // Practice tests
    async createPracticeTest(topicId, questionCount) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to create practice tests.');
      }

      const savedQuestions = await this.getQuestions(topicId, true);
      const selectedQuestions = savedQuestions
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(questionCount, savedQuestions.length));
      
      const questionIds = selectedQuestions.map(q => q.id);
      const duration = questionCount * 120;
      const test = await supabaseService.createPracticeTest(topicId, questionIds, duration);
      
      return {
        ...test,
        questions: selectedQuestions
      };
    },

    async submitTestResults(testId, answers, score) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to submit test results.');
      }
      return await supabaseService.submitTestResults(testId, answers, score);
    },

    // Flashcard progress
    async updateFlashcardProgress(topicId, questionId, known) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to track progress.');
      }
      await supabaseService.updateFlashcardProgress(questionId, known);
      await supabaseService.recordProgress(topicId, questionId, known, 'flashcard');
    },

    async getFlashcardProgress(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view progress.');
      }
      return await supabaseService.getFlashcardProgress(topicId);
    },

    // Study progress
    async recordProgress(topicId, questionId, result, type) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to record progress.');
      }
      return await supabaseService.recordProgress(topicId, questionId, result, type);
    },

    async getProgress(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view progress.');
      }

      const progress = await supabaseService.getProgress(topicId);
      
      // Calculate stats
      const totalAnswered = progress.length;
      const correctAnswers = progress.filter(p => p.result).length;
      const accuracy = totalAnswered > 0 ? (correctAnswers / totalAnswered) * 100 : 0;
      
      // Generate dummy charts data for now
      const retentionCurve = Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        retention: 100 - (i * 10) + Math.random() * 20
      }));
      
      const performanceData = Array.from({ length: 10 }, (_, i) => ({
        date: new Date(Date.now() - (9 - i) * 86400000).toISOString().split('T')[0],
        score: 60 + Math.random() * 40
      }));
      
      return {
        totalAnswered,
        accuracy: Math.round(accuracy),
        flashcardsReviewed: 0, // TODO: Calculate from flashcard progress
        upcomingReviews: 0, // TODO: Calculate from flashcard progress
        retentionCurve,
        performanceData
      };
    },

    // HISTORY AND SOURCE TRACKING METHODS

    // Get topic history (sources and generations)
    async getTopicHistory(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view history.');
      }
      return await supabaseService.getTopicHistory(topicId);
    },

    // Get detailed generation history
    async getGenerationHistory(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view generation history.');
      }
      return await supabaseService.getGenerationHistory(topicId);
    },

    // Get sources with statistics
    async getSourcesWithStats(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view sources.');
      }
      return await supabaseService.getSourcesWithStats(topicId);
    },

    // Get all sources for a topic
    async getSources(topicId) {
      if (!user) {
        throw new Error('Authentication required. Please sign in to view sources.');
      }
      return await supabaseService.getSources(topicId);
    }
  };

  const value = {
    user,
    loading,
    useSupabase: true, // Always true now
    dataService,
    signOut: async () => {
      await auth.signOut();
      setUser(null);
    }
  };

  // Make dataService available for debugging (development only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    window.dataService = dataService;
    window.user = user;
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
} 