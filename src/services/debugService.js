// DEBUG SERVICE - Comprehensive error tracking and fixing
export class DebugService {
  constructor() {
    this.errors = [];
    this.logs = [];
  }

  log(message, data = null) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
      data,
      level: 'info'
    };
    this.logs.push(logEntry);
    console.log(`[DEBUG] ${message}`, data || '');
  }

  error(message, error = null, data = null) {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message,
      error: error?.message || error,
      stack: error?.stack,
      data,
      level: 'error'
    };
    this.errors.push(errorEntry);
    console.error(`[ERROR] ${message}`, error || '', data || '');
  }

  async testOpenAIConnection() {
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    
    if (!apiKey) {
      this.error('OpenAI API key not found in environment variables');
      return false;
    }

    if (!apiKey.startsWith('sk-')) {
      this.error('Invalid OpenAI API key format');
      return false;
    }

    try {
      this.log('Testing OpenAI API connection...');
      
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.error(`OpenAI API test failed: ${response.status} ${response.statusText}`, null, errorData);
        return false;
      }

      const data = await response.json();
      this.log('OpenAI API connection successful', { modelCount: data.data?.length || 0 });
      return true;
    } catch (error) {
      this.error('OpenAI API connection test failed', error);
      return false;
    }
  }

  async testSupabaseConnection() {
    try {
      this.log('Testing Supabase connection...');
      
      const { supabase } = await import('../lib/supabase');
      
      // Test auth
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        this.error('Supabase auth test failed', authError);
        return false;
      }

      if (!user) {
        this.error('No authenticated user found');
        return false;
      }

      this.log('Supabase auth successful', { userId: user.id });

      // Test database connection
      const { data, error } = await supabase.from('topics').select('count').limit(1);
      if (error) {
        this.error('Supabase database test failed', error);
        return false;
      }

      this.log('Supabase database connection successful');

      // Test storage
      const { data: buckets, error: storageError } = await supabase.storage.listBuckets();
      if (storageError) {
        this.error('Supabase storage test failed', storageError);
        return false;
      }

      const documentsBucket = buckets?.find(b => b.name === 'documents');
      if (!documentsBucket) {
        this.error('Documents storage bucket not found');
        return false;
      }

      this.log('Supabase storage test successful', { buckets: buckets.length });
      return true;
    } catch (error) {
      this.error('Supabase connection test failed', error);
      return false;
    }
  }

  async testYouTubeProcessing(url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ') {
    try {
      this.log('Testing YouTube processing...', { url });
      
      const { fileProcessingService } = await import('./fileProcessingService');
      const result = await fileProcessingService.processYouTubeURL(url);
      
      this.log('YouTube processing successful', {
        hasTranscript: result.metadata?.hasTranscript,
        wordCount: result.metadata?.wordCount,
        extractedLength: result.extractedText?.length
      });
      
      return true;
    } catch (error) {
      this.error('YouTube processing test failed', error);
      return false;
    }
  }

  async runComprehensiveTest() {
    this.log('Starting comprehensive system test...');
    
    const results = {
      openai: await this.testOpenAIConnection(),
      supabase: await this.testSupabaseConnection(),
      youtube: await this.testYouTubeProcessing()
    };

    this.log('Comprehensive test completed', results);
    
    return {
      success: Object.values(results).every(r => r === true),
      results,
      errors: this.errors,
      logs: this.logs
    };
  }

  getReport() {
    return {
      errors: this.errors,
      logs: this.logs,
      errorCount: this.errors.length,
      logCount: this.logs.length
    };
  }

  clear() {
    this.errors = [];
    this.logs = [];
  }
}

export const debugService = new DebugService(); 