import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Youtube, FileText, Loader2, CheckCircle, AlertCircle, Brain, Calendar, File, Image, Code, FileCheck, Globe, Trash2, Eye, X, Edit2, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notificationService } from '../services/notificationService';
import { formatFileSize } from '../utils/formatFileSize';

function IngestionTab({ topic, documents = [], onUpdate, dataService }) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [textContent, setTextContent] = useState('');
  const [textSourceName, setTextSourceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [processingFile, setProcessingFile] = useState(null);
  
  // NEW: Multi-select state for sources
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [generatingFromSelected, setGeneratingFromSelected] = useState(false);
  
  // NEW: Delete state for individual sources
  const [deletingSource, setDeletingSource] = useState(null);
  
  // NEW: Preview state
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState(null);
  
  // NEW: Source name editing state
  const [editingSource, setEditingSource] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [savingName, setSavingName] = useState(null);

  // NEW: Keyboard support for preview modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && previewDocument) {
        closePreview();
      }
    };

    if (previewDocument) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [previewDocument]);

  // NEW: Handle source selection
  const handleSourceSelection = (sourceId, checked) => {
    const newSelected = new Set(selectedSources);
    if (checked) {
      newSelected.add(sourceId);
    } else {
      newSelected.delete(sourceId);
    }
    setSelectedSources(newSelected);
  };

  // NEW: Select/deselect all sources
  const handleSelectAll = (checked) => {
    if (checked) {
      const allSourceIds = new Set(documents.map(doc => doc.id));
      setSelectedSources(allSourceIds);
    } else {
      setSelectedSources(new Set());
    }
  };

  // NEW: Handle individual source deletion
  const handleDeleteSource = async (sourceId, sourceName) => {
    if (!confirm(`Are you sure you want to delete "${sourceName}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingSource(sourceId);
    
    try {
      // Call the existing deleteDocument method
      await dataService.deleteDocument(sourceId);
      
      // Show success notification
      notificationService.showSuccess('Source deleted', `"${sourceName}" has been removed from your content library.`);
      
      // Remove from selected sources if it was selected
      const newSelected = new Set(selectedSources);
      newSelected.delete(sourceId);
      setSelectedSources(newSelected);
      
      // Trigger refresh of the documents list
      onUpdate();
    } catch (error) {
      console.error('Delete source error:', error);
      
      // Show error notification
      notificationService.showError('Failed to delete source', 'Please try again or contact support if the issue persists.');
      
      // Also show in upload status for visibility
      setUploadStatus({ 
        type: 'error', 
        message: `❌ Failed to delete "${sourceName}": ${error.message}` 
      });
    } finally {
      setDeletingSource(null);
    }
  };

  // NEW: Handle source preview
  const handlePreviewSource = async (doc) => {
    setPreviewDocument(doc);
    setPreviewLoading(true);
    setPreviewContent(null);

    try {
      let content = null;

      // Handle different content types
      if (doc.source_type === 'text' || doc.metadata?.isTextContent) {
        // For text content, get from knowledge base or use stored content_text
        if (doc.content_text) {
          content = {
            type: 'text',
            content: doc.content_text,
            language: 'text'
          };
        } else {
          // Fallback: get from knowledge base
          const knowledgeBase = await dataService.getKnowledgeBase(topic.id);
          const kbEntry = knowledgeBase.find(kb => kb.document_id === doc.id);
          if (kbEntry) {
            content = {
              type: 'text',
              content: kbEntry.content,
              language: 'text'
            };
          }
        }
      } else if (doc.source_type === 'web' || doc.type === 'web' || doc.metadata?.isWebContent) {
        // For web content, get from knowledge base
        const knowledgeBase = await dataService.getKnowledgeBase(topic.id);
        const kbEntry = knowledgeBase.find(kb => kb.document_id === doc.id);
        if (kbEntry) {
          content = {
            type: 'text',
            content: kbEntry.content,
            language: 'html',
            title: doc.source || 'Web Content'
          };
        }
      } else if (doc.source_type === 'youtube' || doc.type === 'youtube') {
        // For YouTube content, get transcript from knowledge base
        const knowledgeBase = await dataService.getKnowledgeBase(topic.id);
        const kbEntry = knowledgeBase.find(kb => kb.document_id === doc.id);
        if (kbEntry) {
          content = {
            type: 'text',
            content: kbEntry.content,
            language: 'text',
            title: doc.source || 'YouTube Transcript'
          };
        }
      } else if (doc.storage_path) {
        // For files with storage, get signed URL and determine preview type
        const signedUrl = await dataService.getFileUrl(doc.storage_path);
        
        if (signedUrl) {
          const fileType = doc.file_type || doc.metadata?.fileType || '';
          
          if (fileType.includes('pdf')) {
            content = {
              type: 'pdf',
              url: signedUrl,
              filename: doc.filename
            };
          } else if (fileType.includes('image')) {
            content = {
              type: 'image',
              url: signedUrl,
              filename: doc.filename
            };
          } else if (fileType.includes('audio')) {
            // For audio files, show both the player and the transcript
            const knowledgeBase = await dataService.getKnowledgeBase(topic.id);
            const kbEntry = knowledgeBase.find(kb => kb.document_id === doc.id);
            content = {
              type: 'audio',
              url: signedUrl,
              filename: doc.filename,
              transcript: kbEntry?.content || 'No transcript available',
              metadata: doc.metadata?.audioMetadata
            };
          } else {
            // For other file types, try to get extracted text from knowledge base
            const knowledgeBase = await dataService.getKnowledgeBase(topic.id);
            const kbEntry = knowledgeBase.find(kb => kb.document_id === doc.id);
            
            if (kbEntry) {
              // Determine language for syntax highlighting
              let language = 'text';
              if (doc.metadata?.isCodeFile && doc.metadata?.language) {
                language = String(doc.metadata.language).toLowerCase();
              } else if (doc.metadata?.isJSONFile) {
                language = 'json';
              } else if (doc.metadata?.isXMLFile) {
                language = 'xml';
              } else if (doc.metadata?.isHTMLFile) {
                language = 'html';
              } else if (doc.metadata?.isCSVFile) {
                language = 'csv';
              }
              
              content = {
                type: 'text',
                content: kbEntry.content,
                language: language,
                filename: doc.filename
              };
            } else {
              // Fallback: show file info
              content = {
                type: 'file-info',
                filename: doc.filename,
                fileType: fileType,
                fileSize: doc.file_size,
                url: signedUrl
              };
            }
          }
        }
      }

      if (!content) {
        throw new Error('Unable to preview this content type');
      }

      setPreviewContent(content);
    } catch (error) {
      console.error('Preview error:', error);
      notificationService.showError('Preview failed', error.message || 'Unable to preview this content');
      setPreviewDocument(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  // NEW: Close preview modal
  const closePreview = () => {
    setPreviewDocument(null);
    setPreviewContent(null);
    setPreviewLoading(false);
  };

  // NEW: Handle source name editing
  const handleEditSourceName = (doc) => {
    setEditingSource(doc.id);
    setEditingName(getDisplayName(doc));
  };

  // NEW: Save source name edit
  const handleSaveSourceName = async (docId) => {
    if (!editingName.trim()) {
      setEditingSource(null);
      return;
    }

    setSavingName(docId);
    
    try {
      // Update the document's filename/source in the database
      await dataService.updateDocument(docId, {
        filename: editingName.trim()
      });
      
      // Show success notification
      notificationService.showSuccess('Source renamed', `Source has been renamed to "${editingName.trim()}".`);
      
      // Clear editing state
      setEditingSource(null);
      setEditingName('');
      
      // Trigger refresh to show updated name
      onUpdate();
    } catch (error) {
      console.error('Failed to update source name:', error);
      notificationService.showError('Failed to rename source', 'Please try again or contact support if the issue persists.');
    } finally {
      setSavingName(null);
    }
  };

  // NEW: Cancel source name editing
  const handleCancelEditName = () => {
    setEditingSource(null);
    setEditingName('');
  };

  // NEW: Get display name for a document
  const getDisplayName = (doc) => {
    // For real files, prefer the original filename
    if (doc.storage_path && doc.filename) {
      return doc.filename;
    }
    
    // For text content, YouTube, web content, etc., use the source field
    if (doc.source) {
      return doc.source;
    }
    
    // Fallback to filename if available
    if (doc.filename) {
      return doc.filename;
    }
    
    // Default fallbacks based on type
    if (doc.source_type === 'text' || doc.metadata?.isTextContent) {
      return 'Text Content';
    } else if (doc.source_type === 'youtube' || doc.type === 'youtube') {
      return 'YouTube Transcript';
    } else if (doc.source_type === 'web' || doc.type === 'web' || doc.metadata?.isWebContent) {
      return 'Web Content';
    } else if (doc.type === 'audio' || doc.metadata?.isAudioFile) {
      return 'Audio Transcript';
    }
    
    return 'Untitled Source';
  };

  // NEW: Generate questions from selected sources
  const handleGenerateFromSelected = async () => {
    if (selectedSources.size === 0) {
      setUploadStatus({ 
        type: 'error', 
        message: '📋 Please select at least one source to generate questions from.' 
      });
      return;
    }

    setGeneratingFromSelected(true);
    setUploadStatus(null);
    setProcessingFile(`AI analyzing ${selectedSources.size} selected source(s)...`);

    try {
      const selectedSourceIds = Array.from(selectedSources);
      const result = await dataService.generateFromSources({ 
        topicId: topic.id, 
        sourceIds: selectedSourceIds 
      });
      
      setUploadStatus({ 
        type: 'success', 
        message: `🧠 AI successfully generated ${result.generated} additional study items from ${selectedSourceIds.length} selected source(s)! 
        📚 ${result.breakdown?.flashcards || 0} flashcards
        ❓ ${result.breakdown?.multipleChoice || 0} multiple choice questions  
        ✍️ ${result.breakdown?.openEnded || 0} open-ended questions
        📝 ${result.breakdown?.summaries || 0} summaries
        
        These have been added to your existing question pool. Check the Question Pool tab to review them!` 
      });
      
      // Clear selection after successful generation
      setSelectedSources(new Set());
      onUpdate();
    } catch (error) {
      console.error('Selective AI generation error:', error);
      let errorMessage = 'Failed to generate content from selected sources. ';
      
      if (error.message.includes('No content found')) {
        errorMessage = '📄 No content found for the selected sources. Please try different sources.';
      } else if (error.message.includes('OpenAI API error')) {
        errorMessage = '🤖 AI service temporarily unavailable. Please try again later.';
      } else if (error.message.includes('API key')) {
        errorMessage = '🔑 AI service configuration error. Please contact support.';
      } else {
        errorMessage += 'Please try again or contact support if the issue persists.';
      }
      
      setUploadStatus({ type: 'error', message: errorMessage });
    } finally {
      setGeneratingFromSelected(false);
      setProcessingFile(null);
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFiles(e.dataTransfer.files);
    }
  }, [topic.id]);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;

    // Force refresh the session before upload
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        console.error('Session refresh failed:', sessionError);
        alert('Please sign out and sign back in to upload files');
        return;
      }
      console.log('Session refreshed, user:', session.user.email);
    } catch (error) {
      console.error('Session check failed:', error);
      alert('Authentication error - please refresh the page');
      return;
    }

    setLoading(true);
    setUploadStatus(null);

    try {
      const results = [];
      for (const file of files) {
        setProcessingFile(file.name);
        try {
          const result = await dataService.ingest({ topicId: topic.id, file });
          results.push(result);
        } catch (error) {
          // Handle legacy Office format errors with helpful messages
          if (error.message.includes('Legacy Office format detected')) {
            throw new Error(`${file.name}: ${error.message}`);
          }
          throw error;
        }
      }
      
      const totalProcessed = results.length;
      const totalExtracted = results.reduce((sum, r) => sum + (r.wordCount || 0), 0);
      
      setUploadStatus({ 
        type: 'success', 
        message: `✅ Successfully processed ${totalProcessed} file(s) and extracted ${totalExtracted.toLocaleString()} words of content!` 
      });
      onUpdate();
    } catch (error) {
      console.error('File upload error:', error);
      setUploadStatus({ 
        type: 'error', 
        message: `❌ Failed to process files: ${error.message}` 
      });
    } finally {
      setLoading(false);
      setProcessingFile(null);
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    if (!youtubeUrl.trim()) return;

    setLoading(true);
    setUploadStatus(null);
    setProcessingFile('YouTube transcript extraction...');

    try {
      console.log('[UI] Starting YouTube processing for:', youtubeUrl.trim());
      
      const result = await dataService.ingest({ topicId: topic.id, url: youtubeUrl.trim() });
      
      console.log('[UI] YouTube processing result:', result);
      
      const successMessage = result.hasTranscript === false 
        ? `🎥 YouTube video processed! No transcript available - manual notes template added (${result.wordCount?.toLocaleString() || 'content'} words). You can edit the content to add your own notes.`
        : `🎥 YouTube video successfully processed! Extracted ${result.wordCount?.toLocaleString() || 'content'} words from transcript.`;
      
      setUploadStatus({ 
        type: 'success', 
        message: successMessage
      });
      setYoutubeUrl('');
      onUpdate();
    } catch (error) {
      console.error('[UI] YouTube processing error:', error);
      
      // Enhanced error handling with user-friendly messages
      const errorMessage = error.message || 'Unknown error occurred';
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('row-level security')) {
        userFriendlyMessage = '🔒 Database permission error. The RLS policies may need to be updated. Please contact support.';
      } else if (errorMessage.includes('not authenticated')) {
        userFriendlyMessage = '🔑 Please sign in again to continue.';
      } else if (errorMessage.includes('Invalid YouTube URL')) {
        userFriendlyMessage = '🔗 Please check the YouTube URL format and try again.';
      } else if (errorMessage.includes('No transcript available')) {
        userFriendlyMessage = '📝 This video has no captions available. Try a different video or add manual notes instead.';
      } else if (errorMessage.includes('Failed to upload transcript')) {
        userFriendlyMessage = '💾 Storage upload failed. Please try again or contact support if the issue persists.';
      } else if (errorMessage.includes('Failed to save document metadata')) {
        userFriendlyMessage = '💾 Database save failed. Please try again or contact support if the issue persists.';
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage = '⏱️ Request timed out. Please try again with a shorter video or check your connection.';
      }
      
      setUploadStatus({ 
        type: 'error', 
        message: `❌ Failed to process YouTube video: ${userFriendlyMessage}` 
      });
      
      // Log detailed error for debugging
      console.error('[UI] Detailed YouTube error:', {
        originalError: error,
        message: errorMessage,
        stack: error.stack,
        url: youtubeUrl.trim(),
        topicId: topic.id
      });
    } finally {
      setLoading(false);
      setProcessingFile(null);
    }
  };

  const handleWebUrlSubmit = async (e) => {
    e.preventDefault();
    if (!webUrl.trim()) return;

    setLoading(true);
    setUploadStatus(null);
    setProcessingFile('Scraping website content...');

    try {
      console.log('[UI] Starting web URL processing for:', webUrl.trim());
      
      const result = await dataService.ingestWebURL({ topicId: topic.id, url: webUrl.trim() });
      
      console.log('[UI] Web URL processing result:', result);
      
      setUploadStatus({ 
        type: 'success', 
        message: `🌐 Website content successfully scraped and added as a source! Extracted ${result.wordCount?.toLocaleString() || 'content'} words from "${result.content?.source || 'webpage'}". The content is now available in your Content Library for question generation.`
      });
      setWebUrl('');
      onUpdate();
    } catch (error) {
      console.error('[UI] Web URL processing error:', error);
      
      // Enhanced error handling with user-friendly messages
      const errorMessage = error.message || 'Unknown error occurred';
      let userFriendlyMessage = errorMessage;
      
      if (errorMessage.includes('Invalid URL')) {
        userFriendlyMessage = '🔗 Invalid URL format. Please enter a valid website URL.';
      } else if (errorMessage.includes('CORS restrictions')) {
        userFriendlyMessage = '🚫 Unable to access this website due to security restrictions. Try a different URL.';
      } else if (errorMessage.includes('No content')) {
        userFriendlyMessage = '📄 No meaningful content found on this webpage. Please try a different URL.';
      } else if (errorMessage.includes('not authenticated')) {
        userFriendlyMessage = '🔑 Please sign in again to continue.';
      } else if (errorMessage.includes('Failed to fetch')) {
        userFriendlyMessage = '🌐 Unable to access the website. Please check the URL and try again.';
      }
      
      setUploadStatus({ 
        type: 'error', 
        message: `❌ Failed to scrape website: ${userFriendlyMessage}` 
      });
      
      // Log detailed error for debugging
      console.error('[UI] Detailed web URL error:', {
        originalError: error,
        message: errorMessage,
        stack: error.stack,
        url: webUrl.trim(),
        topicId: topic.id
      });
    } finally {
      setLoading(false);
      setProcessingFile(null);
    }
  };

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textContent.trim()) return;

    setLoading(true);
    setUploadStatus(null);
    setProcessingFile('Processing text content...');

    try {
      const sourceName = textSourceName.trim() || 'Pasted Text';
      const result = await dataService.ingest({ 
        topicId: topic.id, 
        contentText: textContent.trim(),
        sourceName 
      });
      setUploadStatus({ 
        type: 'success', 
        message: `📝 Text content successfully processed! Added ${result.wordCount?.toLocaleString() || 'content'} words to your topic.` 
      });
      setTextContent('');
      setTextSourceName('');
      onUpdate();
    } catch (error) {
      console.error('Text ingestion error:', error);
      setUploadStatus({ 
        type: 'error', 
        message: `❌ Failed to process text content: ${error.message}` 
      });
    } finally {
      setLoading(false);
      setProcessingFile(null);
    }
  };

  const handleGenerateContent = async () => {
    setLoading(true);
    setUploadStatus(null);
    setProcessingFile('AI analyzing your content...');

    try {
      const result = await dataService.generate({ topicId: topic.id });
      setUploadStatus({ 
        type: 'success', 
        message: `🧠 AI successfully generated ${result.generated} study items! 
        📚 ${result.breakdown?.flashcards || 0} flashcards
        ❓ ${result.breakdown?.multipleChoice || 0} multiple choice questions  
        ✍️ ${result.breakdown?.openEnded || 0} open-ended questions
        📝 ${result.breakdown?.summaries || 0} summaries
        
        Check the Question Pool tab to review and save them!` 
      });
      onUpdate();
    } catch (error) {
      console.error('AI generation error:', error);
      let errorMessage = 'Failed to generate content. ';
      
      if (error.message.includes('No documents uploaded')) {
        errorMessage = '📄 Please upload documents first before generating content.';
      } else if (error.message.includes('OpenAI API error')) {
        errorMessage = '🤖 AI service temporarily unavailable. Please try again later.';
      } else if (error.message.includes('API key')) {
        errorMessage = '🔑 AI service configuration error. Please contact support.';
      } else {
        errorMessage += 'Please try again or contact support if the issue persists.';
      }
      
      setUploadStatus({ type: 'error', message: errorMessage });
    } finally {
      setLoading(false);
      setProcessingFile(null);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
  };

  const getFileIcon = (doc) => {
    if (doc.type === 'youtube' || doc.source_type === 'youtube') return <Youtube className="h-5 w-5 text-red-600" />;
    if (doc.source_type === 'text' || doc.metadata?.isTextContent) return <FileText className="h-5 w-5 text-green-600" />;
    if (doc.type === 'web' || doc.source_type === 'web' || doc.metadata?.isWebContent) return <Globe className="h-5 w-5 text-orange-600" />;
    if (doc.type === 'audio' || doc.metadata?.isAudioFile) return (
      <svg className="h-5 w-5 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    );
    if (doc.metadata?.isCSVFile) return <FileCheck className="h-5 w-5 text-orange-600" />;
    if (doc.metadata?.isPowerPointPresentation) return <FileCheck className="h-5 w-5 text-orange-500" />;
    if (doc.metadata?.isExcelSpreadsheet) return <FileCheck className="h-5 w-5 text-green-500" />;
    if (doc.metadata?.isWordDocument) return <FileCheck className="h-5 w-5 text-blue-600" />;
    if (doc.metadata?.isXMLFile) return <Code className="h-5 w-5 text-yellow-600" />;
    if (doc.metadata?.isJSONFile) return <Code className="h-5 w-5 text-blue-500" />;
    if (doc.metadata?.isHTMLFile) return <Code className="h-5 w-5 text-orange-600" />;
    if (doc.metadata?.isCodeFile) return <Code className="h-5 w-5 text-green-600" />;
    if (doc.metadata?.processedWithOCR) return <Image className="h-5 w-5 text-purple-600" />;
    if (doc.metadata?.fileType?.includes('pdf')) return <File className="h-5 w-5 text-red-600" />;
    if (doc.metadata?.fileType?.includes('word')) return <FileCheck className="h-5 w-5 text-blue-600" />;
    return <FileText className="h-5 w-5 text-gray-400" />;
  };

  const getFileTypeLabel = (doc) => {
    if (doc.type === 'youtube' || doc.source_type === 'youtube') return 'YouTube Video';
    if (doc.source_type === 'text' || doc.metadata?.isTextContent) return 'Text Content';
    if (doc.type === 'web' || doc.source_type === 'web' || doc.metadata?.isWebContent) return 'Web Page';
    if (doc.type === 'audio' || doc.metadata?.isAudioFile) {
      const duration = doc.metadata?.audioMetadata?.duration;
      const durationText = duration ? ` (${Math.floor(duration / 60)}:${(duration % 60).toFixed(0).padStart(2, '0')})` : '';
      return `Audio Transcript${durationText}`;
    }
    if (doc.metadata?.isCSVFile) return `${doc.metadata?.csvInfo?.format || 'CSV'} Data (${doc.metadata?.csvInfo?.totalRows || 0} rows)`;
    if (doc.metadata?.isPowerPointPresentation) return `PowerPoint (${doc.metadata?.slideCount || 0} slides)`;
    if (doc.metadata?.isExcelSpreadsheet) return `Excel (${doc.metadata?.worksheetCount || 0} sheets)`;
    if (doc.metadata?.isWordDocument) return 'Word Document';
    if (doc.metadata?.isXMLFile) return 'XML Document';
    if (doc.metadata?.isJSONFile) return 'JSON Data';
    if (doc.metadata?.isHTMLFile) return 'HTML Document';
    if (doc.metadata?.isCodeFile) return `${doc.metadata.language} Code`;
    if (doc.metadata?.processedWithOCR) return 'Image (OCR)';
    if (doc.metadata?.fileType?.includes('pdf')) return 'PDF Document';
    if (doc.metadata?.fileType?.includes('word')) return 'Word Document';
    return 'Text Document';
  };

  return (
    <div className="space-y-6">
      {/* Enhanced File Upload Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-indigo-600" />
          Universal File Upload
        </h3>
        
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="hidden"
            multiple
            onChange={handleFileInput}
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer"
          >
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2 font-medium">
              Drop any file type here, or click to select
            </p>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4 text-sm">
              <div className="bg-blue-50 p-3 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600 mx-auto mb-2" />
                <p className="font-medium text-blue-800">Documents</p>
                <p className="text-blue-600">PDF, TXT, MD</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg">
                <FileCheck className="h-5 w-5 text-indigo-600 mx-auto mb-2" />
                <p className="font-medium text-indigo-800">Office Files</p>
                <p className="text-indigo-600">DOCX, PPTX, XLSX</p>
              </div>
              <div className="bg-orange-50 p-3 rounded-lg">
                <FileCheck className="h-5 w-5 text-orange-600 mx-auto mb-2" />
                <p className="font-medium text-orange-800">Data Files</p>
                <p className="text-orange-600">CSV, TSV</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <Code className="h-5 w-5 text-green-600 mx-auto mb-2" />
                <p className="font-medium text-green-800">Code & Data</p>
                <p className="text-green-600">JS, HTML, JSON, XML</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <Image className="h-5 w-5 text-purple-600 mx-auto mb-2" />
                <p className="font-medium text-purple-800">Images (OCR)</p>
                <p className="text-purple-600">JPG, PNG, GIF</p>
              </div>
              <div className="bg-pink-50 p-3 rounded-lg">
                <svg className="h-5 w-5 text-pink-600 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
                <p className="font-medium text-pink-800">Audio Files</p>
                <p className="text-pink-600">MP3, WAV, M4A</p>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Enhanced YouTube URL Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Youtube className="h-5 w-5 mr-2 text-red-600" />
          YouTube Video Transcript Extraction
        </h3>
        
        <p className="text-gray-600 mb-4 text-sm">
          🎥 Extract full transcripts from YouTube videos with captions. Works with educational content, lectures, tutorials, and more.
        </p>
        
        <form onSubmit={handleYoutubeSubmit} className="flex gap-3">
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
            className="flex-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !youtubeUrl.trim()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Extract Transcript'}
          </button>
        </form>
      </div>

      {/* Website URL Scraping Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Globe className="h-5 w-5 mr-2 text-indigo-600" />
          Paste any website URL to scrape content
        </h3>
        
        <p className="text-gray-600 mb-4 text-sm">
          🌐 Enter any webpage URL and we'll pull its text, tag it as a source, and make it available for question generation.
        </p>
        
        <form onSubmit={handleWebUrlSubmit} className="flex gap-3">
          <input
            type="url"
            value={webUrl}
            onChange={(e) => setWebUrl(e.target.value)}
            placeholder="https://example.com/article or any website URL..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={loading || !webUrl.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Scrape Content'}
          </button>
        </form>
      </div>

      {/* Direct Text Input Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-indigo-600" />
          Direct Text Input
        </h3>
        
        <p className="text-gray-600 mb-4 text-sm">
          📝 Paste any text content directly - lecture notes, articles, study materials, or any text you want to convert into study materials.
        </p>
        
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div>
            <label htmlFor="source-name" className="block text-sm font-medium text-gray-700 mb-2">
              Source Name (optional)
            </label>
            <input
              id="source-name"
              type="text"
              value={textSourceName}
              onChange={(e) => setTextSourceName(e.target.value)}
              placeholder="e.g., Chapter 5 Notes, Lecture Summary, Article..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label htmlFor="text-content" className="block text-sm font-medium text-gray-700 mb-2">
              Text Content
            </label>
            <textarea
              id="text-content"
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste your text content here... lecture notes, study materials, articles, etc."
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-vertical"
            />
            {textContent.trim() && (
              <p className="text-xs text-gray-500 mt-1">
                📝 {textContent.trim().split(/\s+/).length} words
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={loading || !textContent.trim()}
            className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
            Add Text Content
          </button>
        </form>
      </div>

      {/* Enhanced Generate Content Button */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg shadow p-6 border border-indigo-100">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Brain className="h-5 w-5 mr-2 text-indigo-600" />
          🧠 AI-Powered Study Material Generation
        </h3>
        <p className="text-gray-600 mb-4">
          Our advanced AI analyzes your uploaded content and generates comprehensive study materials using OpenAI GPT-4:
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
          <div className="bg-white p-2 rounded text-center">
            <span className="font-medium text-indigo-600">📚 Flashcards</span>
          </div>
          <div className="bg-white p-2 rounded text-center">
            <span className="font-medium text-green-600">❓ Multiple Choice</span>
          </div>
          <div className="bg-white p-2 rounded text-center">
            <span className="font-medium text-purple-600">✍️ Open-Ended</span>
          </div>
          <div className="bg-white p-2 rounded text-center">
            <span className="font-medium text-orange-600">📝 Summaries</span>
          </div>
        </div>
        <button
          onClick={handleGenerateContent}
          disabled={loading || documents.length === 0}
          className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-md hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              AI is analyzing your content...
            </>
          ) : (
            <>
              <Brain className="h-5 w-5 mr-2" />
              Generate Study Materials with AI
            </>
          )}
        </button>
        {documents.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">📄 Upload documents or add YouTube videos first to generate AI-powered study materials</p>
        )}
      </div>

      {/* Processing Status */}
      {processingFile && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-center">
          <Loader2 className="h-5 w-5 mr-2 animate-spin text-blue-600" />
          <span className="text-blue-800">Processing: {processingFile}</span>
        </div>
      )}

      {/* Upload Status */}
      {uploadStatus && (
        <div className={`p-4 rounded-lg flex items-start ${
          uploadStatus.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
          )}
          <div className="whitespace-pre-line">{uploadStatus.message}</div>
        </div>
      )}

      {/* Enhanced Uploaded Content List with Multi-Select */}
      {documents.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📋 Content Library ({documents.length} items)</h3>
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={documents.length > 0 && selectedSources.size === documents.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Select All</span>
              </label>
              <span className="text-sm text-gray-500">
                {selectedSources.size} of {documents.length} selected
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className={`flex items-start p-4 rounded-lg border transition-colors ${
                selectedSources.has(doc.id) 
                  ? 'bg-indigo-50 border-indigo-200' 
                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
              }`}>
                <div className="flex-shrink-0 mr-3 flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSources.has(doc.id)}
                    onChange={(e) => handleSourceSelection(doc.id, e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 mr-3"
                  />
                  {getFileIcon(doc)}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Source name with inline editing */}
                  <div className="flex items-center space-x-2">
                    {editingSource === doc.id ? (
                      <div className="flex items-center space-x-2 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveSourceName(doc.id);
                            } else if (e.key === 'Escape') {
                              handleCancelEditName();
                            }
                          }}
                          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          placeholder="Enter source name"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveSourceName(doc.id)}
                          disabled={savingName === doc.id}
                          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                          title="Save name"
                        >
                          {savingName === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={handleCancelEditName}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="Cancel editing"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 flex-1 group">
                        <h4 className="text-sm font-medium text-gray-900 truncate flex-1">
                          {getDisplayName(doc)}
                        </h4>
                        <button
                          onClick={() => handleEditSourceName(doc)}
                          className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Edit name"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Source metadata */}
                  <div className="flex items-center text-xs text-gray-500 mt-1 space-x-3">
                    <span>{getFileTypeLabel(doc)}</span>
                    {doc.metadata?.wordCount && (
                      <span>{doc.metadata.wordCount.toLocaleString()} words</span>
                    )}
                    {doc.file_size && (
                      <span>{formatFileSize(doc.file_size)}</span>
                    )}
                    <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {/* Action Buttons */}
                <div className="flex-shrink-0 ml-3 flex items-center space-x-2">
                  {/* Preview Button */}
                  <button
                    onClick={() => handlePreviewSource(doc)}
                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                    title="Preview content"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteSource(doc.id, doc.source || doc.filename)}
                    disabled={deletingSource === doc.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete source"
                  >
                    {deletingSource === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {/* NEW: Generate More Questions Button */}
          {selectedSources.size > 0 && (
            <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-800">
                    🎯 Generate questions from {selectedSources.size} selected source{selectedSources.size !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    New questions will be added to your existing question pool
                  </p>
                </div>
                <button
                  onClick={handleGenerateFromSelected}
                  disabled={generatingFromSelected || selectedSources.size === 0}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-md hover:from-purple-700 hover:to-pink-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  {generatingFromSelected ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Brain className="h-4 w-4 mr-2" />
                      Generate More Questions
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          
          <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
            <p className="text-sm text-indigo-800">
              💡 <strong>Ready for AI?</strong> Select specific sources above to generate targeted questions, or use "Generate Study Materials with AI" above to process all content at once.
            </p>
          </div>
        </div>
      )}
      
      {/* Preview Modal */}
      {previewDocument && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            // Close modal when clicking on backdrop
            if (e.target === e.currentTarget) {
              closePreview();
            }
          }}
        >
          <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                {getFileIcon(previewDocument)}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {previewDocument.source || previewDocument.filename}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {getFileTypeLabel(previewDocument)}
                  </p>
                </div>
              </div>
              <button
                onClick={closePreview}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                title="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden">
              {previewLoading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-gray-600">Loading preview...</p>
                  </div>
                </div>
              ) : previewContent ? (
                <div className="h-full overflow-auto">
                  {/* PDF Preview */}
                  {previewContent.type === 'pdf' && (
                    <div className="h-full">
                      <iframe
                        src={previewContent.url}
                        className="w-full h-full border-0"
                        title={`PDF Preview: ${previewContent.filename}`}
                      />
                    </div>
                  )}

                  {/* Image Preview */}
                  {previewContent.type === 'image' && (
                    <div className="flex items-center justify-center p-4 h-full">
                      <img
                        src={previewContent.url}
                        alt={previewContent.filename}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                      />
                    </div>
                  )}

                  {/* Audio Preview */}
                  {previewContent.type === 'audio' && (
                    <div className="p-6 space-y-6">
                      {/* Audio Player */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                          <svg className="h-5 w-5 text-pink-600 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                          </svg>
                          Audio Player
                        </h4>
                        <audio controls className="w-full">
                          <source src={previewContent.url} />
                          Your browser does not support the audio element.
                        </audio>
                        {previewContent.metadata && (
                          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-600">
                            {previewContent.metadata.duration && (
                              <div>
                                <span className="font-medium">Duration:</span> {Math.floor(previewContent.metadata.duration / 60)}:{(previewContent.metadata.duration % 60).toFixed(0).padStart(2, '0')}
                              </div>
                            )}
                            {previewContent.metadata.language && (
                              <div>
                                <span className="font-medium">Language:</span> {previewContent.metadata.language}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Transcript */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                          <FileText className="h-5 w-5 text-blue-600 mr-2" />
                          Transcript
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                          <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono">
                            {previewContent.transcript}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Text/Code Preview */}
                  {previewContent.type === 'text' && (
                    <div className="p-6">
                      {previewContent.title && (
                        <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                          <FileText className="h-5 w-5 text-blue-600 mr-2" />
                          {previewContent.title}
                        </h4>
                      )}
                      <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className={`whitespace-pre-wrap text-sm font-mono ${
                          previewContent.language === 'json' ? 'text-blue-700' :
                          previewContent.language === 'html' ? 'text-orange-700' :
                          previewContent.language === 'xml' ? 'text-purple-700' :
                          previewContent.language === 'css' ? 'text-green-700' :
                          previewContent.language === 'javascript' ? 'text-yellow-700' :
                          'text-gray-700'
                        }`}>
                          {previewContent.content}
                        </pre>
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        {previewContent.content.length.toLocaleString()} characters • {previewContent.content.split(/\s+/).length.toLocaleString()} words
                      </div>
                    </div>
                  )}

                  {/* File Info Preview */}
                  {previewContent.type === 'file-info' && (
                    <div className="p-6">
                      <div className="text-center py-12">
                        <File className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">
                          {previewContent.filename}
                        </h4>
                        <p className="text-gray-600 mb-4">
                          This file type cannot be previewed directly.
                        </p>
                        <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
                          <dl className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <dt className="text-gray-500">File Type:</dt>
                              <dd className="text-gray-900">{previewContent.fileType}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-gray-500">File Size:</dt>
                              <dd className="text-gray-900">{formatFileSize(previewContent.fileSize)}</dd>
                            </div>
                          </dl>
                          <a
                            href={previewContent.url}
                            download={previewContent.filename}
                            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Download File
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600">Failed to load preview</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 rounded-b-lg">
              <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                  <span>📅 {formatDate(previewDocument.created_at)}</span>
                  {previewDocument.metadata?.wordCount && (
                    <span>📝 {previewDocument.metadata.wordCount.toLocaleString()} words</span>
                  )}
                  {previewDocument.file_size && (
                    <span>💾 {formatFileSize(previewDocument.file_size)}</span>
                  )}
                </div>
                <button
                  onClick={closePreview}
                  className="px-3 py-1 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngestionTab; 