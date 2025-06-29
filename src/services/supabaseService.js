import { supabase } from '../lib/supabase';
import { fileProcessingService } from './fileProcessingService';
import { notificationService } from './notificationService';

export const supabaseService = {
  // Topic management
  async getTopics() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  async createTopic(name) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('topics')
      .insert([{ name, user_id: user.id }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getTopic(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTopic(id, updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('topics')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTopic(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First, get all documents for this topic to delete from storage
    const { data: documents } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('topic_id', id)
      .eq('user_id', user.id);

    // Delete files from storage
    if (documents && documents.length > 0) {
      const filePaths = documents.map(doc => doc.storage_path);
      await supabase.storage
        .from('documents')
        .remove(filePaths);
    }

    // Delete the topic (cascading deletes will handle related records)
    const { error } = await supabase
      .from('topics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    
    if (error) throw error;
  },

  // File upload and document management
  async uploadFile(topicId, file) {
    // Enhanced authentication check with retry logic
    let user = null;
    let retryCount = 0;
    const maxRetries = 3;

    console.log('[DEBUG] Starting uploadFile process:', {
      topicId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

    while (retryCount < maxRetries) {
      const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error(`Authentication error (attempt ${retryCount + 1}):`, authError);
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error('Authentication failed after multiple attempts. Please sign out and sign back in.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retry
        continue;
      }

      if (!currentUser || !currentUser.id) {
        console.error('No authenticated user found');
        retryCount++;
        if (retryCount >= maxRetries) {
          throw new Error('User not authenticated. Please sign in first.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }

      user = currentUser;
      break;
    }

    console.log('[DEBUG] Authenticated user for upload:', {
      userId: user.id,
      email: user.email,
      topicId: topicId,
      filename: file.name
    });

    // Create unique file path: topic_id/user_id/timestamp_filename
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `${topicId}/${user.id}/${timestamp}_${fileName}`;

    console.log('[DEBUG] Generated file path:', filePath);

    // Upload file to Supabase storage
    console.log('[DEBUG] Uploading to storage...');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('[ERROR] Storage upload error:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    console.log('[DEBUG] File uploaded to storage successfully:', filePath);

    // Show extraction notification
    notificationService.showInfo(
      'Content extracted—sending to AI now',
      `Extracted content from ${file.name}. Processing for AI generation...`
    );

    // Save document metadata to database with user_id for RLS compliance
    const documentInsertData = {
      topic_id: topicId,
      user_id: user.id, // Critical: Set user_id for RLS compliance
      filename: file.name,
      storage_path: filePath,
      file_type: file.type,
      file_size: file.size,
      source_type: 'file', // Mark as file upload
      metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    };

    console.log('[DEBUG] Inserting document with data:', {
      topic_id: documentInsertData.topic_id,
      user_id: documentInsertData.user_id,
      filename: documentInsertData.filename,
      storage_path: documentInsertData.storage_path,
      source_type: documentInsertData.source_type
    });

    // Use ultra simple insert function for guaranteed insertion
    console.log('[DEBUG] Using ultra simple insert function for database insert...');
    try {
      const { data: docId, error: bypassError } = await supabase
        .rpc('simple_insert_document', {
          p_topic_id: topicId,
          p_title: file.name,
          p_content: null,
          p_file_size: file.size,
          p_file_type: file.type,
          p_storage_path: filePath
        });

      if (bypassError) {
        console.error('[ERROR] Bypass function failed:', bypassError);
        // Clean up the uploaded file
        await supabase.storage.from('documents').remove([filePath]);
        throw new Error(`Failed to save document: ${bypassError.message}`);
      }

      console.log('[SUCCESS] Document inserted via bypass function:', docId);
      return {
        documentId: docId,
        storagePath: filePath,
        publicUrl: await this.getFileUrl(filePath)
      };
    } catch (insertError) {
      console.error('[ERROR] Bypass insert failed:', insertError);
      // Clean up uploaded file
      await supabase.storage.from('documents').remove([filePath]);
      throw insertError;
    }
  },

  async getFileUrl(storagePath) {
    const { data } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 3600); // 1 hour expiry

    return data?.signedUrl;
  },

  async getDocuments(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    // Add signed URLs for each document
    const documentsWithUrls = await Promise.all(
      (data || []).map(async (doc) => ({
        ...doc,
        signedUrl: await this.getFileUrl(doc.storage_path)
      }))
    );

    return documentsWithUrls;
  },

  async deleteDocument(documentId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Get document info first
      const { data: doc, error: fetchError } = await supabase
        .from('documents')
        .select('storage_path, topic_id')
        .eq('id', documentId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to find document: ${fetchError.message}`);
      }

      // Delete from storage if it exists
      if (doc.storage_path) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([doc.storage_path]);

        if (storageError) {
          console.warn('Failed to delete from storage:', storageError.message);
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(`Failed to delete document: ${deleteError.message}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Document deletion error:', error);
      throw error;
    }
  },

  // Update document metadata (for source name editing)
  async updateDocument(documentId, updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    try {
      // Update document in database
      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', documentId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update document: ${error.message}`);
      }

      return { success: true, document: data };
    } catch (error) {
      console.error('Document update error:', error);
      throw error;
    }
  },

  // Knowledge base management (updated for file storage integration)
  async addToKnowledgeBase(topicId, content, documentId = null) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('knowledge_base')
      .insert([{
        topic_id: topicId,
        user_id: user.id,
        document_id: documentId,
        type: content.type,
        source: content.source,
        content: content.extractedText || content.content,
        metadata: content.metadata
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getKnowledgeBase(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('knowledge_base')
      .select(`
        *,
        documents (
          id,
          filename,
          storage_path,
          file_type,
          file_size
        )
      `)
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // NEW: Get knowledge base content filtered by specific source IDs
  async getKnowledgeBaseBySourceIds(topicId, sourceIds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // First, get the document IDs associated with the selected sources
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('document_id')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .in('id', sourceIds);
    
    if (sourcesError) throw sourcesError;
    
    if (!sources || sources.length === 0) {
      return [];
    }

    // Extract document IDs (filter out null values for text content)
    const documentIds = sources
      .map(s => s.document_id)
      .filter(id => id !== null);

    // Get knowledge base entries for these documents
    let query = supabase
      .from('knowledge_base')
      .select(`
        *,
        documents (
          id,
          filename,
          storage_path,
          file_type,
          file_size
        )
      `)
      .eq('topic_id', topicId)
      .eq('user_id', user.id);

    // If we have document IDs, filter by them
    if (documentIds.length > 0) {
      query = query.in('document_id', documentIds);
    }

    // Also include knowledge base entries that might be associated with text content
    // by checking if the source IDs include any text-based sources
    const { data: textSources, error: textSourcesError } = await supabase
      .from('sources')
      .select('knowledge_base_id')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .in('id', sourceIds)
      .eq('source_type', 'text');

    if (textSourcesError) throw textSourcesError;

    const knowledgeBaseIds = textSources
      ?.map(s => s.knowledge_base_id)
      .filter(id => id !== null) || [];

    // Execute the main query
    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;

    let filteredData = data || [];

    // If we have text-based knowledge base IDs, get those entries too
    if (knowledgeBaseIds.length > 0) {
      const { data: textData, error: textError } = await supabase
        .from('knowledge_base')
        .select(`
          *,
          documents (
            id,
            filename,
            storage_path,
            file_type,
            file_size
          )
        `)
        .eq('topic_id', topicId)
        .eq('user_id', user.id)
        .in('id', knowledgeBaseIds)
        .order('created_at', { ascending: false });

      if (textError) throw textError;
      
      // Merge and deduplicate
      const existingIds = new Set(filteredData.map(item => item.id));
      const newTextData = (textData || []).filter(item => !existingIds.has(item.id));
      filteredData = [...filteredData, ...newTextData];
    }

    return filteredData;
  },

  // ENHANCED: Comprehensive file processing with real AI integration and source tracking
  async processFileUpload(topicId, file) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get topic name for logging
    const topic = await this.getTopic(topicId);
    let extractedContent = null;
    let uploadResult = null;

    try {
      console.log('[EXTRACTION-DEBUG] Starting file processing for:', {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        topicId: topicId
      });

      // 1. Process file with comprehensive extraction (PDF, OCR, Code, etc.)
      extractedContent = await fileProcessingService.processFile(file);
      
      console.log('[EXTRACTION-DEBUG] File processing successful:', {
        extractedTextLength: extractedContent.extractedText?.length || 0,
        wordCount: extractedContent.metadata?.wordCount || 0,
        fileType: extractedContent.metadata?.fileType
      });
      
      // 2. Upload file to storage and save document metadata with enhanced metadata
      uploadResult = await this.uploadFile(topicId, file);
      
      console.log('[EXTRACTION-DEBUG] File upload successful:', {
        documentId: uploadResult.documentId,
        storagePath: uploadResult.storagePath
      });
      
      // 3. Update document metadata with extraction results
      await supabase
        .from('documents')
        .update({ 
          metadata: {
            ...extractedContent.metadata,
            originalName: file.name,
            uploadedAt: new Date().toISOString()
          },
          user_id: user.id // Ensure user_id is set for RLS
        })
        .eq('id', uploadResult.documentId);
      
      // 4. Save extracted content to knowledge base
      const knowledgeBaseEntry = await this.addToKnowledgeBase(topicId, extractedContent, uploadResult.documentId);
      
      // 4.5. Show "Content extracted—sending to AI now" notification
      notificationService.showInfo(
        '📄 Content extracted successfully!',
        {
          message: `Extracted ${extractedContent.metadata?.wordCount || 0} words from ${file.name}. Ready for AI processing.`,
          fileName: file.name,
          wordCount: extractedContent.metadata?.wordCount || 0,
          fileType: extractedContent.metadata?.fileType || file.type
        }
      );
      
      // 5. Create source tracking entry
      const sourceType = extractedContent.type === 'audio' ? 'audio' : 'file';
      const sourceEntry = await this.createSource({
        topicId,
        documentId: uploadResult.documentId,
        sourceType: sourceType,
        sourceName: file.name,
        originalName: file.name,
        fileType: file.type,
        fileSize: file.size,
        wordCount: extractedContent.metadata?.wordCount || 0,
        metadata: extractedContent.metadata,
        knowledgeBaseId: knowledgeBaseEntry.id
      });

      // 6. Log successful source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: sourceType,
        sourceName: file.name,
        wordCount: extractedContent.metadata?.wordCount || 0,
        fileSize: file.size,
        success: true,
        sourceId: sourceEntry.id
      });
      
      return {
        success: true,
        documentId: uploadResult.documentId,
        sourceId: sourceEntry.id,
        content: extractedContent,
        wordCount: extractedContent.metadata?.wordCount || 0,
        fileType: extractedContent.metadata?.fileType,
        processed: true
      };
    } catch (error) {
      console.error('[EXTRACTION-ERROR] File processing failed:', {
        fileName: file.name,
        fileType: file.type,
        error: error.message,
        stack: error.stack,
        extractedContentAvailable: !!extractedContent,
        uploadResultAvailable: !!uploadResult
      });
      
      // Determine source type for logging (default to 'file' if extraction failed)
      const sourceType = extractedContent?.type === 'audio' ? 'audio' : 'file';
      
      // Log failed source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: sourceType,
        sourceName: file.name,
        success: false,
        error: error.message || 'Unknown processing error'
      });
      
      // Provide more specific error messages
      let errorMessage = error.message || 'Unknown processing error';
      
      if (error.message?.includes('fileProcessingService')) {
        errorMessage = 'File processing service error - check console for details';
      } else if (error.message?.includes('uploadFile')) {
        errorMessage = 'File upload failed - check storage permissions';
      } else if (error.message?.includes('RLS')) {
        errorMessage = 'Authentication error - please sign out and sign back in';
      }
      
      throw new Error(`Failed to process ${file.name}: ${errorMessage}`);
    }
  },

  // NEW: Process plain text content without file upload
  async processTextContent(topicId, contentText, sourceName = 'Pasted Text') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get topic name for logging
    const topic = await this.getTopic(topicId);

    try {
      // 1. Create document entry for text content using simple insert function
      const { data: docId, error: docError } = await supabase
        .rpc('simple_insert_document', {
          p_topic_id: topicId,
          p_title: sourceName,
          p_content: contentText,
          p_file_size: contentText.length,
          p_file_type: 'text/plain',
          p_storage_path: null
        });

      if (docError) {
        console.error('Document creation failed:', docError);
        throw new Error(`Failed to save text content: ${docError.message}`);
      }

      // 2. Create extracted content object for knowledge base
      const extractedContent = {
        type: 'text',
        source: sourceName,
        extractedText: contentText,
        metadata: {
          wordCount: contentText.split(/\s+/).length,
          fileType: 'text/plain',
          uploadDate: new Date().toISOString(),
          isTextContent: true
        }
      };

      // 3. Save extracted content to knowledge base
      const knowledgeBaseEntry = await this.addToKnowledgeBase(topicId, extractedContent, docId);

      // 3.5. Show "Content extracted—sending to AI now" notification
      notificationService.showInfo(
        '📝 Text content processed successfully!',
        {
          message: `Processed ${extractedContent.metadata.wordCount} words from "${sourceName}". Ready for AI processing.`,
          sourceName: sourceName,
          wordCount: extractedContent.metadata.wordCount
        }
      );

      // 4. Create source tracking entry
      const sourceEntry = await this.createSource({
        topicId,
        documentId: docId,
        sourceType: 'text',
        sourceName: sourceName,
        originalName: sourceName,
        fileType: 'text/plain',
        fileSize: contentText.length,
        wordCount: extractedContent.metadata.wordCount,
        metadata: extractedContent.metadata,
        knowledgeBaseId: knowledgeBaseEntry.id
      });

      // 5. Log successful source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: 'text',
        sourceName: sourceName,
        wordCount: extractedContent.metadata.wordCount,
        fileSize: contentText.length,
        success: true,
        sourceId: sourceEntry.id
      });

      return {
        success: true,
        documentId: docId,
        sourceId: sourceEntry.id,
        content: extractedContent,
        wordCount: extractedContent.metadata.wordCount,
        fileType: 'text/plain',
        processed: true
      };
    } catch (error) {
      console.error('Text processing error:', error);
      
      // Log failed source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: 'text',
        sourceName: sourceName,
        success: false,
        error: error.message
      });
      
      throw new Error(`Failed to process text content: ${error.message}`);
    }
  },

  // NEW: Process web URL by scraping content and generating AI materials
  async processWebURL(topicId, url) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get topic name for logging
    const topic = await this.getTopic(topicId);

    try {
      console.log('[DEBUG] Starting web URL processing for:', url);
      
      // 1. Extract content from webpage
      const extractedContent = await fileProcessingService.processWebURL(url);
      console.log('[DEBUG] Web content extracted:', {
        title: extractedContent.source,
        wordCount: extractedContent.metadata?.wordCount
      });
      
      // 2. Create document entry for web content
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert([{
          topic_id: topicId,
          user_id: user.id,
          filename: extractedContent.source,
          storage_path: null, // No file storage for web content
          file_type: 'text/html',
          file_size: extractedContent.metadata?.contentLength || 0,
          source_type: 'web',
          metadata: extractedContent.metadata
        }])
        .select()
        .single();

      if (docError) {
        console.error('Document creation failed:', docError);
        throw new Error(`Failed to save web content: ${docError.message}`);
      }

      // 3. Save extracted content to knowledge base
      const knowledgeBaseEntry = await this.addToKnowledgeBase(topicId, extractedContent, docData.id);
      
      // 3.5. Show "Content extracted—sending to AI now" notification
      notificationService.showInfo(
        '🌐 Website content scraped successfully!',
        {
          message: `Extracted ${extractedContent.metadata?.wordCount || 0} words from "${extractedContent.source}". Sending to AI for processing...`,
          url: url,
          title: extractedContent.source,
          wordCount: extractedContent.metadata?.wordCount || 0
        }
      );
      
      // 4. Create source tracking entry
      const sourceEntry = await this.createSource({
        topicId,
        documentId: docData.id,
        sourceType: 'web',
        sourceName: extractedContent.source,
        originalName: url,
        fileType: 'text/html',
        fileSize: extractedContent.metadata?.contentLength || 0,
        wordCount: extractedContent.metadata?.wordCount || 0,
        metadata: extractedContent.metadata,
        knowledgeBaseId: knowledgeBaseEntry.id
      });

      // 5. Generate AI content immediately from this source
      const aiResult = await this.generateAIContentFromSources(topicId, [sourceEntry.id]);

      // 6. Log successful source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: 'web',
        sourceName: extractedContent.source,
        wordCount: extractedContent.metadata?.wordCount || 0,
        fileSize: extractedContent.metadata?.contentLength || 0,
        success: true,
        sourceId: sourceEntry.id
      });
      
      return {
        success: true,
        documentId: docData.id,
        sourceId: sourceEntry.id,
        content: extractedContent,
        wordCount: extractedContent.metadata?.wordCount || 0,
        aiGeneration: aiResult,
        processed: true
      };
    } catch (error) {
      console.error('Web URL processing error:', error);
      
      // Log failed source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: 'web',
        sourceName: url,
        success: false,
        error: error.message
      });
      
      throw new Error(`Failed to process website: ${error.message}`);
    }
  },

  // NEW: Process direct text input and generate AI materials instantly
  async processDirectTextInput(topicId, textContent, promptTitle = 'Custom Text Input') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get topic name for logging
    const topic = await this.getTopic(topicId);

    try {
      console.log('[DEBUG] Starting direct text processing:', {
        title: promptTitle,
        textLength: textContent.length
      });
      
      // 1. Process the direct text input
      const extractedContent = await fileProcessingService.processDirectText(textContent, promptTitle);
      console.log('[DEBUG] Direct text processed:', {
        title: extractedContent.source,
        wordCount: extractedContent.metadata?.wordCount
      });
      
      // 2. For direct text, we'll generate AI content immediately without storing as a permanent source
      // Create a temporary knowledge base entry for AI processing
      const tempKnowledgeBase = [{
        extractedText: extractedContent.extractedText,
        source: extractedContent.source,
        metadata: extractedContent.metadata
      }];

      // 3. Generate AI content directly from the text
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please contact support.');
      }

      const aiResult = await fileProcessingService.generateAIContent(
        topic.name, 
        tempKnowledgeBase, 
        apiKey
      );

      // 4. Create a generation record for tracking
      const generation = await this.createGeneration({
        topicId,
        generationType: 'direct_text',
        sourceIds: [], // No permanent source for direct text
        status: 'processing'
      });

      // 5. Save generated questions to database
      const questions = await this.addQuestionsWithGeneration(topicId, aiResult.content, generation.id, []);

      // 6. Create generation items for tracking
      await this.createGenerationItems(generation.id, questions, []);

      // 7. Update generation record
      await this.updateGeneration(generation.id, {
        status: 'completed',
        itemsGenerated: aiResult.generated,
        breakdown: aiResult.breakdown,
        completedAt: new Date().toISOString()
      });

      // 8. Log successful content generation
      notificationService.logContentGeneration({
        topicId,
        topicName: topic.name,
        sourceIds: [],
        generationType: 'direct_text',
        itemsGenerated: aiResult.generated,
        breakdown: aiResult.breakdown,
        generationId: generation.id,
        success: true
      });
      
      return {
        success: true,
        content: extractedContent,
        wordCount: extractedContent.metadata?.wordCount || 0,
        aiGeneration: aiResult,
        generationId: generation.id,
        processed: true
      };
    } catch (error) {
      console.error('Direct text processing error:', error);
      
      // Log failed content generation
      notificationService.logContentGeneration({
        topicId,
        topicName: topic.name,
        sourceIds: [],
        generationType: 'direct_text',
        success: false,
        error: error.message
      });
      
      throw new Error(`Failed to process text input: ${error.message}`);
    }
  },

  // ENHANCED: YouTube transcript processing with source tracking and storage
  async processYouTubeURL(topicId, url) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get topic name for logging
    const topic = await this.getTopic(topicId);

    try {
      console.log('[DEBUG] Starting YouTube processing for:', url);
      
      // 1. Extract transcript using comprehensive service
      const extractedContent = await fileProcessingService.processYouTubeURL(url);
      console.log('[DEBUG] Transcript extracted:', {
        hasTranscript: extractedContent.metadata?.hasTranscript,
        wordCount: extractedContent.metadata?.wordCount,
        textLength: extractedContent.extractedText?.length
      });
      
      // 2. Generate storage path and prepare transcript content for upload
      const videoId = this.extractYouTubeVideoId(url) || 'unknown';
      const timestamp = Date.now();
      const sanitizedVideoId = videoId.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitize for filename
      const filename = `video-${sanitizedVideoId}.txt`;
      const filePath = `documents/${topicId}/${user.id}/${timestamp}_${filename}`;
      
      // Create comprehensive transcript file content
      const transcriptContent = `YouTube Video Transcript
URL: ${url}
Video ID: ${videoId}
Extracted: ${new Date().toISOString()}
Has Transcript: ${extractedContent.metadata?.hasTranscript || false}
Word Count: ${extractedContent.metadata?.wordCount || 0}

${extractedContent.metadata?.hasTranscript === false ? 
  'Note: No transcript was available for this video. Manual notes were added instead.\n\n' : 
  'Transcript Content:\n\n'
}${extractedContent.extractedText}`;

      const transcriptBlob = new Blob([transcriptContent], { type: 'text/plain' });
      console.log('[DEBUG] Prepared transcript blob:', {
        size: transcriptBlob.size,
        filePath: filePath
      });
      
      // 3. Upload transcript to storage FIRST - this ensures we have a valid storage_path
      console.log('[DEBUG] Uploading to storage...');
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, transcriptBlob);

      if (uploadError) {
        console.error('[ERROR] Storage upload failed:', uploadError);
        throw new Error(`Failed to upload transcript: ${uploadError.message}`);
      }
      console.log('[DEBUG] Storage upload successful:', uploadData);

      // 4. ONLY create document entry AFTER successful storage upload
      // This guarantees storage_path is never null and user_id is set for RLS
      console.log('[DEBUG] Creating document entry...');
      
      // Validate user authentication before proceeding
      if (!user || !user.id) {
        throw new Error('User authentication failed - no valid user ID');
      }
      
      const documentData = {
        topic_id: topicId,
        user_id: user.id, // Critical: Set user_id for RLS compliance
        filename: extractedContent.source || `YouTube Video ${videoId}`,
        storage_path: filePath, // Guaranteed to be valid since upload succeeded
        file_type: 'youtube/video',
        file_size: transcriptBlob.size,
        source_type: 'youtube', // Mark as YouTube content
        metadata: {
          ...extractedContent.metadata,
          originalUrl: url,
          videoId: videoId,
          transcriptFilename: filename,
          uploadedAt: new Date().toISOString(),
          storagePath: filePath // Store path in metadata too for reference
        }
      };
      
      console.log('[DEBUG] Document data to insert:', {
        topic_id: documentData.topic_id,
        user_id: documentData.user_id,
        filename: documentData.filename,
        storage_path: documentData.storage_path,
        source_type: documentData.source_type,
        authenticated_user: user.id
      });

      // Double-check authentication right before insert
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser || currentUser.id !== user.id) {
        throw new Error('User authentication expired during processing');
      }

      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single();

      if (docError) {
        // Clean up uploaded file if document creation fails
        console.error('[ERROR] Document creation failed:', docError);
        console.error('[ERROR] Document data that failed:', documentData);
        await supabase.storage.from('documents').remove([filePath]);
        
        // Enhanced error reporting for RLS issues
        if (docError.code === '42501') {
          console.error('RLS Policy Violation Details:', {
            error: docError,
            userId: user.id,
            topicId: topicId,
            url: url,
            videoId: videoId
          });
          throw new Error(`Authentication failed - please sign out and sign back in. RLS Error: ${docError.message}`);
        }
        
        throw new Error(`Failed to save document metadata: ${docError.message}`);
      }
      console.log('[DEBUG] Document created successfully:', docData.id);
      
      // 5. Save extracted content to knowledge base
      const knowledgeBaseEntry = await this.addToKnowledgeBase(topicId, extractedContent, docData.id);
      
      // 6. Create source tracking entry
      const sourceEntry = await this.createSource({
        topicId,
        documentId: docData.id,
        sourceType: 'youtube',
        sourceName: url,
        originalName: extractedContent.source,
        fileType: 'youtube/video',
        fileSize: transcriptBlob.size,
        wordCount: extractedContent.metadata?.wordCount || 0,
        metadata: {
          ...extractedContent.metadata,
          originalUrl: url,
          videoId: videoId,
          transcriptFilename: filename,
          storagePath: filePath
        },
        knowledgeBaseId: knowledgeBaseEntry.id
      });

      // 7. Log successful source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: 'youtube',
        sourceName: url,
        wordCount: extractedContent.metadata?.wordCount || 0,
        fileSize: transcriptBlob.size,
        success: true,
        sourceId: sourceEntry.id
      });
      
      return {
        success: true,
        documentId: docData.id,
        sourceId: sourceEntry.id,
        content: extractedContent,
        wordCount: extractedContent.metadata?.wordCount || 0,
        hasTranscript: extractedContent.metadata?.hasTranscript || false,
        storagePath: filePath
      };
    } catch (error) {
      console.error('YouTube processing error:', error);
      
      // Log failed source ingestion
      notificationService.logSourceIngestion({
        topicId,
        topicName: topic.name,
        sourceType: 'youtube',
        sourceName: url,
        success: false,
        error: error.message
      });
      
      throw new Error(`Failed to process YouTube video: ${error.message}`);
    }
  },

  // Helper method to extract YouTube video ID
  extractYouTubeVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  },

  // ENHANCED: Real AI content generation with GPT-4 and generation tracking
  async generateAIContent(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get OpenAI API key from environment
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please contact support.');
    }

    const startTime = Date.now();

    try {
      // 1. Get all sources for this topic to track attribution
      const sources = await this.getSources(topicId);
      const sourceIds = sources.map(s => s.id);
      
      if (!sources || sources.length === 0) {
        throw new Error('No sources available for this topic. Please upload content first.');
      }

      // 2. Get knowledge base content for generation
      const knowledgeBase = await this.getKnowledgeBase(topicId);
      
      // 3. Get topic name for context
      const topic = await this.getTopic(topicId);
      
      // 4. Create generation record
      const generation = await this.createGeneration({
        topicId,
        generationType: 'bulk',
        sourceIds,
        status: 'processing'
      });
      
      try {
        // 5. Generate comprehensive AI content using the enhanced service
        const aiResult = await fileProcessingService.generateAIContent(
          topic.name, 
          knowledgeBase, 
          apiKey
        );
        
        // 6. Save generated questions to database with generation tracking
        const questions = await this.addQuestionsWithGeneration(topicId, aiResult.content, generation.id, sourceIds);
        
        // 7. Create generation items for detailed tracking
        await this.createGenerationItems(generation.id, questions, sourceIds);
        
        // 8. Update generation record with results
        const processingTime = Date.now() - startTime;
        await this.updateGeneration(generation.id, {
          status: 'completed',
          itemsGenerated: aiResult.generated,
          breakdown: aiResult.breakdown,
          completedAt: new Date().toISOString(),
          processingTimeMs: processingTime
        });

        // 9. Log successful content generation with comprehensive details
        notificationService.logContentGeneration({
          topicId,
          topicName: topic.name,
          sourceIds,
          generationType: 'bulk',
          itemsGenerated: aiResult.generated,
          breakdown: aiResult.breakdown,
          processingTimeMs: processingTime,
          generationId: generation.id,
          success: true
        });
        
        return {
          success: true,
          generated: aiResult.generated,
          breakdown: aiResult.breakdown,
          generationId: generation.id,
          message: `Successfully generated ${aiResult.generated} study items!`
        };
        
      } catch (generationError) {
        // Update generation record with error
        await this.updateGeneration(generation.id, {
          status: 'failed',
          errorMessage: generationError.message,
          completedAt: new Date().toISOString()
        });

        // Log failed content generation
        notificationService.logContentGeneration({
          topicId,
          topicName: topic.name,
          sourceIds,
          generationType: 'bulk',
          processingTimeMs: Date.now() - startTime,
          generationId: generation.id,
          success: false,
          error: generationError.message
        });

        throw generationError;
      }
      
    } catch (error) {
      console.error('AI generation error:', error);
      
      // Log failed content generation (for cases where generation record wasn't created)
      const topic = await this.getTopic(topicId).catch(() => ({ name: 'Unknown Topic' }));
      notificationService.logContentGeneration({
        topicId,
        topicName: topic.name,
        sourceIds: [],
        generationType: 'bulk',
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message
      });
      
      throw error;
    } finally {
      // Clean up OCR worker if it was used
      await fileProcessingService.terminateOCR();
    }
  },

  // NEW: Generate AI content from specific sources (appends to existing questions)
  async generateAIContentFromSources(topicId, sourceIds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get OpenAI API key from environment
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please contact support.');
    }

    const startTime = Date.now();

    try {
      // 1. Validate source IDs exist and belong to this topic
      const allSources = await this.getSources(topicId);
      const validSourceIds = sourceIds.filter(id => 
        allSources.some(source => source.id === id)
      );
      
      if (validSourceIds.length === 0) {
        throw new Error('No valid sources found for the selected items.');
      }

      // 2. Get filtered knowledge base content for only selected sources
      const filteredKnowledgeBase = await this.getKnowledgeBaseBySourceIds(topicId, validSourceIds);
      
      if (!filteredKnowledgeBase || filteredKnowledgeBase.length === 0) {
        throw new Error('No content found for the selected sources.');
      }
      
      // 3. Get topic name for context
      const topic = await this.getTopic(topicId);
      
      // 4. Create generation record for selective generation
      const generation = await this.createGeneration({
        topicId,
        generationType: 'selective',
        sourceIds: validSourceIds,
        status: 'processing'
      });
      
      try {
        // 5. Generate AI content from filtered sources
        const aiResult = await fileProcessingService.generateAIContent(
          topic.name, 
          filteredKnowledgeBase, 
          apiKey
        );
        
        // 6. Append generated questions to existing pool (no replacement)
        const questions = await this.addQuestionsWithGeneration(topicId, aiResult.content, generation.id, validSourceIds);
        
        // 7. Create generation items for detailed tracking
        await this.createGenerationItems(generation.id, questions, validSourceIds);
        
        // 8. Update generation record with results
        const processingTime = Date.now() - startTime;
        await this.updateGeneration(generation.id, {
          status: 'completed',
          itemsGenerated: aiResult.generated,
          breakdown: aiResult.breakdown,
          completedAt: new Date().toISOString(),
          processingTimeMs: processingTime
        });

        // 9. Log successful selective content generation
        notificationService.logContentGeneration({
          topicId,
          topicName: topic.name,
          sourceIds: validSourceIds,
          generationType: 'selective',
          itemsGenerated: aiResult.generated,
          breakdown: aiResult.breakdown,
          processingTimeMs: processingTime,
          generationId: generation.id,
          success: true
        });
        
        return {
          success: true,
          generated: aiResult.generated,
          breakdown: aiResult.breakdown,
          generationId: generation.id,
          sourceCount: validSourceIds.length,
          message: `Successfully generated ${aiResult.generated} study items from ${validSourceIds.length} selected source(s)!`
        };
        
      } catch (generationError) {
        // Update generation record with error
        await this.updateGeneration(generation.id, {
          status: 'failed',
          errorMessage: generationError.message,
          completedAt: new Date().toISOString()
        });

        // Log failed content generation
        notificationService.logContentGeneration({
          topicId,
          topicName: topic.name,
          sourceIds: validSourceIds,
          generationType: 'selective',
          processingTimeMs: Date.now() - startTime,
          generationId: generation.id,
          success: false,
          error: generationError.message
        });

        throw generationError;
      }
      
    } catch (error) {
      console.error('Selective AI generation error:', error);
      
      // Log failed content generation (for cases where generation record wasn't created)
      const topic = await this.getTopic(topicId).catch(() => ({ name: 'Unknown Topic' }));
      notificationService.logContentGeneration({
        topicId,
        topicName: topic.name,
        sourceIds: sourceIds,
        generationType: 'selective',
        processingTimeMs: Date.now() - startTime,
        success: false,
        error: error.message
      });
      
      throw error;
    } finally {
      // Clean up OCR worker if it was used
      await fileProcessingService.terminateOCR();
    }
  },

  // Question management
  async addQuestions(topicId, questions) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const questionsToInsert = questions.map(q => ({
      topic_id: topicId,
      user_id: user.id,
      type: q.type,
      question_data: q,
      is_saved: false
    }));

    const { data, error } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select();
    
    if (error) throw error;
    return data;
  },

  async getQuestions(topicId, savedOnly = false) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('questions')
      .select('*')
      .eq('topic_id', topicId)
      .eq('user_id', user.id);
    
    if (savedOnly) {
      query = query.eq('is_saved', true);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    
    if (error) throw error;
    return data.map(q => ({ ...q.question_data, id: q.id, is_saved: q.is_saved }));
  },

  async saveQuestion(questionId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('questions')
      .update({ is_saved: true })
      .eq('id', questionId)
      .eq('user_id', user.id);
    
    if (error) throw error;
  },

  // Practice test management
  async createPracticeTest(topicId, questionIds, duration) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('practice_tests')
      .insert([{
        topic_id: topicId,
        user_id: user.id,
        question_ids: questionIds,
        duration
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async submitTestResults(testId, answers, score) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('test_results')
      .insert([{
        test_id: testId,
        user_id: user.id,
        answers,
        score
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Flashcard progress
  async updateFlashcardProgress(questionId, known) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get current progress or create new
    const { data: existing } = await supabase
      .from('flashcard_progress')
      .select('*')
      .eq('question_id', questionId)
      .eq('user_id', user.id)
      .single();

    let interval = 1;
    let reviews = 1;
    
    if (existing) {
      reviews = existing.reviews + 1;
      interval = known ? existing.interval * 2.5 : 1;
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + Math.round(interval));

    const { error } = await supabase
      .from('flashcard_progress')
      .upsert({
        question_id: questionId,
        user_id: user.id,
        reviews,
        last_review: new Date().toISOString(),
        next_review: nextReview.toISOString(),
        interval
      }, {
        onConflict: 'question_id,user_id'
      });
    
    if (error) throw error;
  },

  async getFlashcardProgress(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('flashcard_progress')
      .select(`
        *,
        questions!inner(topic_id, question_data)
      `)
      .eq('questions.topic_id', topicId)
      .eq('user_id', user.id);
    
    if (error) throw error;
    return data;
  },

  // Study progress
  async recordProgress(topicId, questionId, result, type) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('study_progress')
      .insert([{
        topic_id: topicId,
        user_id: user.id,
        question_id: questionId,
        result,
        type
      }]);
    
    if (error) throw error;
  },

  async getProgress(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('study_progress')
      .select('*')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // SOURCE TRACKING AND HISTORY METHODS

  // Create a new source entry
  async createSource({
    topicId,
    documentId = null,
    sourceType,
    sourceName,
    originalName = null,
    fileType = null,
    fileSize = null,
    wordCount = null,
    metadata = {},
    knowledgeBaseId = null
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('sources')
      .insert([{
        topic_id: topicId,
        user_id: user.id,
        document_id: documentId,
        source_type: sourceType,
        source_name: sourceName,
        original_name: originalName,
        file_type: fileType,
        file_size: fileSize,
        word_count: wordCount,
        metadata,
        knowledge_base_id: knowledgeBaseId,
        processed_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get all sources for a topic
  async getSources(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .order('ingested_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Create a new generation record
  async createGeneration({
    topicId,
    generationType,
    sourceIds = [],
    status = 'processing'
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('generations')
      .insert([{
        topic_id: topicId,
        user_id: user.id,
        generation_type: generationType,
        source_ids: sourceIds,
        status
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update generation record
  async updateGeneration(generationId, updates) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('generations')
      .update({
        ...updates,
        ...(updates.status === 'completed' && !updates.completedAt ? { completed_at: new Date().toISOString() } : {}),
        ...(updates.itemsGenerated !== undefined ? { items_generated: updates.itemsGenerated } : {}),
        ...(updates.processingTimeMs !== undefined ? { processing_time_ms: updates.processingTimeMs } : {}),
        ...(updates.errorMessage !== undefined ? { error_message: updates.errorMessage } : {})
      })
      .eq('id', generationId)
      .eq('user_id', user.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Add questions with generation tracking
  async addQuestionsWithGeneration(topicId, questions, generationId, sourceIds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const questionsToInsert = questions.map(q => ({
      topic_id: topicId,
      user_id: user.id,
      type: q.type,
      question_data: q,
      is_saved: false,
      generation_id: generationId,
      source_attribution: sourceIds
    }));

    const { data, error } = await supabase
      .from('questions')
      .insert(questionsToInsert)
      .select();
    
    if (error) throw error;
    return data;
  },

  // Create generation items for detailed tracking
  async createGenerationItems(generationId, questions, sourceIds) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const generationItems = questions.map(q => ({
      generation_id: generationId,
      question_id: q.id,
      item_type: q.question_data?.type || q.type,
      item_title: this.extractItemTitle(q.question_data),
      difficulty: q.question_data?.difficulty || 'medium',
      derived_from_sources: sourceIds
    }));

    const { data, error } = await supabase
      .from('generation_items')
      .insert(generationItems)
      .select();
    
    if (error) throw error;
    return data;
  },

  // Helper to extract title from question data
  extractItemTitle(questionData) {
    if (!questionData) return 'Untitled';
    
    switch (questionData.type) {
      case 'flashcard':
        return questionData.front?.substring(0, 100) || 'Flashcard';
      case 'multiple-choice':
        return questionData.question?.substring(0, 100) || 'Multiple Choice';
      case 'open-ended':
        return questionData.question?.substring(0, 100) || 'Open-Ended Question';
      case 'summary':
        return questionData.title || 'Summary';
      default:
        return 'Study Item';
    }
  },

  // Get topic history (sources and generations)
  async getTopicHistory(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('topic_history')
      .select('*')
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get detailed generation history with items
  async getGenerationHistory(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('generations')
      .select(`
        *,
        generation_items (
          *,
          questions (
            id,
            question_data,
            type,
            is_saved
          )
        )
      `)
      .eq('topic_id', topicId)
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  },

  // Get sources with their generated items count
  async getSourcesWithStats(topicId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get sources
    const sources = await this.getSources(topicId);
    
    // Get generation items that reference each source
    const sourcesWithStats = await Promise.all(
      sources.map(async (source) => {
        const { data: items, error } = await supabase
          .from('generation_items')
          .select('id')
          .contains('derived_from_sources', [source.id]);
        
        if (error) console.error('Error getting source stats:', error);
        
        return {
          ...source,
          generatedItemsCount: items?.length || 0
        };
      })
    );
    
    return sourcesWithStats;
  }
}; 