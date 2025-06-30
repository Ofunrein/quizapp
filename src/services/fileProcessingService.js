import { createWorker } from 'tesseract.js';
import { YoutubeTranscript } from 'youtube-transcript';
import mammoth from 'mammoth';
import PizZip from 'pizzip';

export class FileProcessingService {
  constructor() {
    this.ocrWorker = null;
    this.debugMode = import.meta.env.DEV || false;
  }

  // Enhanced logging method
  logExtractionStep(step, data) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      step,
      ...data
    };
    
    if (this.debugMode) {
      console.log(`[EXTRACTION-${step.toUpperCase()}]`, logData);
    }
    
    // Also log to notification service for debugging
    if (typeof window !== 'undefined' && window.notificationService) {
      window.notificationService.logDeveloperEvent('file_extraction', logData);
    }
  }

  async initializeOCR() {
    if (!this.ocrWorker) {
      this.logExtractionStep('OCR_INIT', { message: 'Initializing Tesseract OCR worker' });
      this.ocrWorker = await createWorker('eng');
      this.logExtractionStep('OCR_READY', { message: 'OCR worker initialized successfully' });
    }
    return this.ocrWorker;
  }

  async terminateOCR() {
    if (this.ocrWorker) {
      this.logExtractionStep('OCR_CLEANUP', { message: 'Terminating OCR worker' });
      await this.ocrWorker.terminate();
      this.ocrWorker = null;
    }
  }

  // Extract YouTube video ID from various URL formats
  extractYouTubeVideoId(url) {
    this.logExtractionStep('YOUTUBE_ID_EXTRACT', { 
      input: { url },
      extractor: 'YouTube URL Parser'
    });
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        this.logExtractionStep('YOUTUBE_ID_SUCCESS', { 
          videoId: match[1],
          pattern: pattern.toString()
        });
        return match[1];
      }
    }
    
    this.logExtractionStep('YOUTUBE_ID_FAILED', { 
      error: 'No valid YouTube video ID found',
      url 
    });
    return null;
  }

  // Get YouTube transcript
  async extractYouTubeTranscript(url) {
    this.logExtractionStep('YOUTUBE_START', {
      input: { url, type: 'YouTube URL' },
      extractor: 'youtube-transcript library'
    });
    
    try {
      const videoId = this.extractYouTubeVideoId(url);
      if (!videoId) {
        throw new Error('Invalid YouTube URL - could not extract video ID');
      }
      
      this.logExtractionStep('YOUTUBE_TRANSCRIPT_FETCH', { 
        videoId,
        message: 'Fetching transcript from YouTube API'
      });

      // Try to get transcript with timeout
      const transcriptPromise = YoutubeTranscript.fetchTranscript(videoId);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transcript fetch timeout after 30 seconds')), 30000)
      );
      
      const transcript = await Promise.race([transcriptPromise, timeoutPromise]);
      
      this.logExtractionStep('YOUTUBE_TRANSCRIPT_SUCCESS', {
        hasTranscript: !!transcript,
        segmentCount: transcript?.length || 0,
        videoId
      });
      
      if (!transcript || transcript.length === 0) {
        throw new Error('No transcript available for this video');
      }

      // Combine all transcript segments into readable text
      const fullText = transcript
        .map(entry => entry.text)
        .join(' ')
        .replace(/\[.*?\]/g, '') // Remove [Music], [Applause] etc.
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      this.logExtractionStep('YOUTUBE_TEXT_PROCESSED', {
        originalSegments: transcript.length,
        finalTextLength: fullText.length,
        wordCount: fullText.split(/\s+/).length,
        extractedTextPreview: fullText.substring(0, 200) + '...'
      });

      return {
        type: 'youtube',
        source: `YouTube Video: ${videoId}`,
        extractedText: fullText,
        metadata: {
          videoId,
          platform: 'YouTube',
          originalUrl: url,
          transcriptSegments: transcript.length,
          duration: Math.max(...transcript.map(t => t.offset + t.duration)),
          wordCount: fullText.split(/\s+/).length,
          extractionDate: new Date().toISOString(),
          hasTranscript: true
        }
      };
    } catch (error) {
      this.logExtractionStep('YOUTUBE_ERROR', {
        error: error.message,
        stack: error.stack,
        url
      });
      
      // Fallback: return placeholder with video info
      const videoId = this.extractYouTubeVideoId(url);
      const fallbackText = `[YouTube Video: ${url}]

Video ID: ${videoId || 'Unknown'}

⚠️ Transcript extraction failed: ${error.message}

This video may not have captions available, or they may be auto-generated and restricted. 

To use this content:
1. Watch the video and manually add key points below
2. Or try a different video with available captions

Manual Notes Section:
- [Add main concepts from the video]
- [Add important explanations]  
- [Add examples or case studies]
- [Add any formulas or definitions]

This content will be used by the AI to generate study materials.`;

      this.logExtractionStep('YOUTUBE_FALLBACK', {
        videoId: videoId || 'unknown',
        fallbackTextLength: fallbackText.length,
        wordCount: fallbackText.split(/\s+/).length
      });

      return {
        type: 'youtube',
        source: `YouTube Video: ${videoId || 'Unknown'}`,
        extractedText: fallbackText,
        metadata: {
          videoId: videoId || 'unknown',
          platform: 'YouTube',
          originalUrl: url,
          hasTranscript: false,
          extractionError: error.message,
          wordCount: fallbackText.split(/\s+/).length,
          extractionDate: new Date().toISOString()
        }
      };
    }
  }

  // Process PDF files
  async extractTextFromPDF(file) {
    this.logExtractionStep('PDF_START', {
      input: { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type 
      },
      extractor: 'PDF.js (browser-compatible)'
    });
    
    try {
      // Use PDF.js for browser-compatible PDF parsing
      const pdfjsLib = await import('pdfjs-dist');
      
      // Set worker source to match the installed version
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
      
      const arrayBuffer = await file.arrayBuffer();
      
      this.logExtractionStep('PDF_PARSING', {
        arrayBufferSize: arrayBuffer.byteLength,
        message: 'Parsing PDF with PDF.js'
      });
      
      // Load the PDF document
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      
      this.logExtractionStep('PDF_LOADED', {
        pages: numPages,
        message: 'PDF loaded successfully'
      });
      
      let fullText = '';
      
      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map(item => item.str).join(' ');
          fullText += pageText + '\n\n';
          
          this.logExtractionStep('PDF_PAGE_PROCESSED', {
            pageNumber: pageNum,
            pageTextLength: pageText.length,
            totalPages: numPages
          });
        } catch (pageError) {
          this.logExtractionStep('PDF_PAGE_ERROR', {
            pageNumber: pageNum,
            error: pageError.message
          });
          console.warn(`Failed to process page ${pageNum}:`, pageError);
        }
      }
      
      // Clean up the extracted text
      fullText = fullText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      if (!fullText.trim()) {
        throw new Error('No readable text content found in PDF');
      }
      
      this.logExtractionStep('PDF_SUCCESS', {
        extractedTextLength: fullText.length,
        wordCount: fullText.split(/\s+/).length,
        pages: numPages,
        extractedTextPreview: fullText.substring(0, 200) + '...'
      });
      
      // Format for study materials
      const processedText = `[PDF Document: ${file.name}]

Document Structure: ${numPages} pages

Content:
${fullText}

This PDF document should be analyzed for:
- Key concepts and definitions
- Main topics and subtopics
- Important facts and details
- Structured information and diagrams
- Educational content and examples`;
      
      return {
        type: 'document',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: 'application/pdf',
          fileSize: file.size,
          pages: numPages,
          wordCount: fullText.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          isPDFDocument: true,
          documentType: 'PDF Document'
        }
      };
    } catch (error) {
      this.logExtractionStep('PDF_ERROR', {
        error: error.message,
        stack: error.stack,
        fileName: file.name,
        fileSize: file.size
      });
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  // Process Word documents (.docx)
  async extractTextFromWord(file) {
    this.logExtractionStep('WORD_START', {
      input: { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type 
      },
      extractor: 'mammoth library'
    });
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      this.logExtractionStep('WORD_PARSING', {
        arrayBufferSize: arrayBuffer.byteLength,
        message: 'Extracting text with mammoth'
      });
      
      const result = await mammoth.extractRawText({ arrayBuffer });
      
      this.logExtractionStep('WORD_SUCCESS', {
        extractedTextLength: result.value.length,
        wordCount: result.value.split(/\s+/).length,
        warnings: result.messages.length,
        extractedTextPreview: result.value.substring(0, 200) + '...'
      });
      
      // Enhanced processing for better study material formatting
      let processedText = result.value;
      
      // Add context for Word documents
      processedText = `[Word Document: ${file.name}]

Document Content:
${result.value}

This Word document should be analyzed for:
- Key concepts and definitions
- Main topics and subtopics
- Important facts and details
- Structured information and lists
- Educational content and examples`;

      return {
        type: 'document',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          wordCount: result.value.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          warnings: result.messages.length,
          isWordDocument: true,
          documentType: 'Word Document'
        }
      };
    } catch (error) {
      this.logExtractionStep('WORD_ERROR', {
        error: error.message,
        stack: error.stack,
        fileName: file.name,
        fileSize: file.size
      });
      throw new Error(`Failed to extract text from Word document: ${error.message}`);
    }
  }

  // Process PowerPoint presentations (.pptx)
  async extractTextFromPowerPoint(file) {
    try {
      console.log('[DEBUG] Processing PowerPoint file:', file.name);
      const arrayBuffer = await file.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
      let slideTexts = [];
      let slideCount = 0;
      
      // Extract text from slides
      const slideFiles = Object.keys(zip.files).filter(filename => 
        filename.startsWith('ppt/slides/slide') && filename.endsWith('.xml')
      );
      
      slideCount = slideFiles.length;
      console.log('[DEBUG] Found', slideCount, 'slides in PowerPoint');
      
      for (const slideFile of slideFiles) {
        try {
          const slideXml = zip.files[slideFile].asText();
          
          // Extract text content from XML (simplified approach)
          const textMatches = slideXml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
          const slideText = textMatches
            .map(match => match.replace(/<[^>]*>/g, ''))
            .filter(text => text.trim())
            .join(' ');
          
          if (slideText.trim()) {
            slideTexts.push(slideText.trim());
          }
        } catch (slideError) {
          console.warn(`Failed to process slide ${slideFile}:`, slideError.message);
        }
      }
      
      // Combine all slide content
      const combinedText = slideTexts.join('\n\n');
      
      if (!combinedText.trim()) {
        throw new Error('No readable text content found in PowerPoint presentation');
      }
      
      // Format for study materials
      let processedText = `[PowerPoint Presentation: ${file.name}]

Presentation Structure: ${slideCount} slides

Content:
${slideTexts.map((text, index) => `Slide ${index + 1}:\n${text}`).join('\n\n')}

This PowerPoint presentation should be analyzed for:
- Key presentation topics and themes
- Main points and bullet items
- Visual content descriptions
- Structured learning objectives
- Sequential information flow
- Educational concepts and examples`;

      return {
        type: 'document',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          wordCount: combinedText.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          isPowerPointPresentation: true,
          documentType: 'PowerPoint Presentation',
          slideCount: slideCount,
          slidesWithContent: slideTexts.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract text from PowerPoint presentation: ${error.message}`);
    }
  }

  // Process Excel files (.xlsx) - basic text extraction
  async extractTextFromExcel(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const zip = new PizZip(arrayBuffer);
      
      let worksheetTexts = [];
      let worksheetCount = 0;
      
      // Find worksheet files
      const worksheetFiles = Object.keys(zip.files).filter(filename => 
        filename.startsWith('xl/worksheets/sheet') && filename.endsWith('.xml')
      );
      
      worksheetCount = worksheetFiles.length;
      
      // Extract shared strings (Excel stores text separately)
      let sharedStrings = [];
      try {
        const sharedStringsXml = zip.files['xl/sharedStrings.xml']?.asText();
        if (sharedStringsXml) {
          const stringMatches = sharedStringsXml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
          sharedStrings = stringMatches.map(match => match.replace(/<[^>]*>/g, ''));
        }
      } catch (e) {
        console.warn('Could not extract shared strings from Excel file');
      }
      
      // Process each worksheet
      for (const worksheetFile of worksheetFiles) {
        try {
          const worksheetXml = zip.files[worksheetFile].asText();
          
          // Extract cell values and references to shared strings
          const cellMatches = worksheetXml.match(/<c[^>]*>.*?<\/c>/g) || [];
          const worksheetData = [];
          
          cellMatches.forEach(cellMatch => {
            // Check if it's a shared string reference
            if (cellMatch.includes('t="s"')) {
              const valueMatch = cellMatch.match(/<v>(\d+)<\/v>/);
              if (valueMatch && sharedStrings[parseInt(valueMatch[1])]) {
                worksheetData.push(sharedStrings[parseInt(valueMatch[1])]);
              }
            } else {
              // Direct text value
              const textMatch = cellMatch.match(/<v>([^<]*)<\/v>/);
              if (textMatch) {
                worksheetData.push(textMatch[1]);
              }
            }
          });
          
          if (worksheetData.length > 0) {
            worksheetTexts.push(worksheetData.join(' '));
          }
        } catch (worksheetError) {
          console.warn(`Failed to process worksheet ${worksheetFile}:`, worksheetError.message);
        }
      }
      
      const combinedText = worksheetTexts.join('\n\n');
      
      if (!combinedText.trim()) {
        throw new Error('No readable text content found in Excel file');
      }
      
      // Format for study materials
      let processedText = `[Excel Spreadsheet: ${file.name}]

Workbook Structure: ${worksheetCount} worksheets

Content:
${worksheetTexts.map((text, index) => `Worksheet ${index + 1}:\n${text}`).join('\n\n')}

This Excel spreadsheet should be analyzed for:
- Data patterns and numerical information
- Text labels and descriptions
- Structured data relationships
- Tabular information and calculations
- Business or academic data insights`;

      return {
        type: 'document',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          wordCount: combinedText.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          isExcelSpreadsheet: true,
          documentType: 'Excel Spreadsheet',
          worksheetCount: worksheetCount,
          worksheetsWithContent: worksheetTexts.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract text from Excel file: ${error.message}`);
    }
  }

  // Process images with OCR
  async extractTextFromImage(file) {
    this.logExtractionStep('OCR_START', {
      input: { 
        fileName: file.name, 
        fileSize: file.size, 
        fileType: file.type 
      },
      extractor: 'Tesseract.js OCR'
    });
    
    try {
      await this.initializeOCR();
      
      this.logExtractionStep('OCR_PROCESSING', {
        message: 'Running OCR text recognition',
        fileName: file.name
      });
      
      const { data: { text } } = await this.ocrWorker.recognize(file);
      
      this.logExtractionStep('OCR_SUCCESS', {
        extractedTextLength: text.length,
        wordCount: text.split(/\s+/).length,
        extractedTextPreview: text.substring(0, 200) + '...',
        hasText: !!text.trim()
      });
      
      if (!text.trim()) {
        throw new Error('No text detected in image');
      }

      return {
        type: 'document',
        source: file.name,
        extractedText: text,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          wordCount: text.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          processedWithOCR: true
        }
      };
    } catch (error) {
      this.logExtractionStep('OCR_ERROR', {
        error: error.message,
        stack: error.stack,
        fileName: file.name,
        fileSize: file.size
      });
      throw new Error(`Failed to extract text from image: ${error.message}`);
    }
  }

  // Process CSV and TSV files
  async extractTextFromCSV(file) {
    try {
      const text = await file.text();
      
      if (!text.trim()) {
        throw new Error('CSV/TSV file appears to be empty');
      }

      // Detect separator (CSV uses comma, TSV uses tab)
      const isTSV = file.name.toLowerCase().endsWith('.tsv');
      const separator = isTSV ? '\t' : ',';
      const fileTypeLabel = isTSV ? 'TSV' : 'CSV';

      // Parse data
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        throw new Error(`No valid data found in ${fileTypeLabel} file`);
      }

      // Get headers from first row
      const headers = lines[0].split(separator).map(h => h.trim().replace(/"/g, ''));
      const dataRows = lines.slice(1);

      // Convert to readable text format
      let processedText = `[${fileTypeLabel} Data File: ${file.name}]

Data Structure: ${headers.length} columns, ${dataRows.length} rows

Column Headers:
${headers.map((header, i) => `${i + 1}. ${header}`).join('\n')}

Sample Data (first 10 rows):
`;

      // Add sample data (first 10 rows)
      const sampleRows = dataRows.slice(0, 10);
      sampleRows.forEach((row, index) => {
        const values = row.split(separator).map(v => v.trim().replace(/"/g, ''));
        processedText += `\nRow ${index + 1}:\n`;
        headers.forEach((header, i) => {
          processedText += `  ${header}: ${values[i] || 'N/A'}\n`;
        });
      });

      if (dataRows.length > 10) {
        processedText += `\n... and ${dataRows.length - 10} more rows\n`;
      }

      processedText += `\nData Summary:
- Total Records: ${dataRows.length}
- Columns: ${headers.length}
- File Size: ${(file.size / 1024).toFixed(2)} KB
- Format: ${fileTypeLabel} (${separator === '\t' ? 'Tab' : 'Comma'} separated)

This ${fileTypeLabel} data should be analyzed for:
- Data patterns and trends
- Key relationships between columns
- Statistical insights and distributions
- Important data points and outliers
- Business or research insights`;

      return {
        type: 'document',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: isTSV ? 'text/tsv' : 'text/csv',
          fileSize: file.size,
          wordCount: processedText.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          isCSVFile: true,
          isTSVFile: isTSV,
          csvInfo: {
            totalRows: dataRows.length,
            totalColumns: headers.length,
            headers: headers,
            sampleRowsShown: Math.min(10, dataRows.length),
            separator: separator,
            format: fileTypeLabel
          }
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract text from ${fileTypeLabel}: ${error.message}`);
    }
  }

  // Process plain text and code files
  async extractTextFromTextFile(file) {
    try {
      const text = await file.text();
      
      if (!text.trim()) {
        throw new Error('File appears to be empty');
      }

      // Detect if it's a code file or structured data file
      const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.cpp', '.c', '.h', '.java', '.cs', '.php', '.rb', '.go', '.rs', '.asm', '.sql', '.html', '.css', '.json', '.xml', '.yaml', '.yml'];
      const isCodeFile = codeExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

      // Special handling for structured data files
      const isXMLFile = file.name.toLowerCase().endsWith('.xml');
      const isJSONFile = file.name.toLowerCase().endsWith('.json');
      const isHTMLFile = file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm');

      let processedText = text;
      
      if (isXMLFile) {
        // Enhanced XML processing
        processedText = `[XML Data File: ${file.name}]

File Type: ${this.detectLanguage(file.name)}

XML Structure and Content:
${text}

This XML file should be analyzed for:
- Data structure and hierarchy
- Element relationships and attributes
- Configuration or data content
- Schema patterns and organization
- Key information and values`;
      } else if (isJSONFile) {
        // Enhanced JSON processing
        try {
          const jsonData = JSON.parse(text);
          const dataStructure = this.analyzeJSONStructure(jsonData);
          
          processedText = `[JSON Data File: ${file.name}]

File Type: ${this.detectLanguage(file.name)}
Structure: ${dataStructure.summary}

JSON Content:
${JSON.stringify(jsonData, null, 2)}

This JSON file should be analyzed for:
- Data structure and object relationships
- Key-value pairs and data types
- Configuration settings or data records
- API responses or data exchange formats
- Nested structures and arrays`;
        } catch (jsonError) {
          // If JSON parsing fails, treat as regular text
          processedText = `[JSON File: ${file.name}]

File Type: ${this.detectLanguage(file.name)}

Content (Invalid JSON):
${text}

This file appears to be JSON but has parsing errors. It should be analyzed for:
- Potential JSON structure
- Data patterns and formatting
- Configuration or data content`;
        }
      } else if (isHTMLFile) {
        // Enhanced HTML processing
        processedText = `[HTML Document: ${file.name}]

File Type: ${this.detectLanguage(file.name)}

HTML Content:
${text}

This HTML document should be analyzed for:
- Web page structure and content
- Text content within HTML elements
- Semantic markup and organization
- Educational or informational content
- Key concepts presented in the document`;
      } else if (isCodeFile) {
        // Add context for other code files
        processedText = `[Code File: ${file.name}]

Programming Language: ${this.detectLanguage(file.name)}

Code Content:
${text}

This is source code that should be analyzed for:
- Key programming concepts and patterns
- Important functions and algorithms  
- Best practices and techniques
- Common errors and debugging approaches
- Framework or library usage`;
      }

      return {
        type: 'document',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: file.type || 'text/plain',
          fileSize: file.size,
          wordCount: text.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          isCodeFile,
          isXMLFile,
          isJSONFile,
          isHTMLFile,
          language: this.detectLanguage(file.name),
          documentType: isXMLFile ? 'XML Document' : 
                       isJSONFile ? 'JSON Data' : 
                       isHTMLFile ? 'HTML Document' : 
                       isCodeFile ? 'Code File' : 'Text Document'
        }
      };
    } catch (error) {
      throw new Error(`Failed to extract text from file: ${error.message}`);
    }
  }

  // Analyze JSON structure for better processing
  analyzeJSONStructure(data, depth = 0) {
    if (depth > 3) return { summary: 'deeply nested structure' };
    
    if (Array.isArray(data)) {
      const length = data.length;
      const firstItemType = length > 0 ? typeof data[0] : 'unknown';
      return { summary: `Array with ${length} items (${firstItemType} type)` };
    } else if (typeof data === 'object' && data !== null) {
      const keys = Object.keys(data);
      const keyCount = keys.length;
      const sampleKeys = keys.slice(0, 3).join(', ');
      return { summary: `Object with ${keyCount} properties (${sampleKeys}${keyCount > 3 ? '...' : ''})` };
    } else {
      return { summary: `${typeof data} value` };
    }
  }

  // Process audio files with OpenAI Whisper transcription
  async extractTextFromAudio(file) {
    try {
      console.log('[DEBUG] Processing audio file:', file.name, 'Type:', file.type, 'Size:', file.size);
      
      // Get OpenAI API key
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OpenAI API key not configured. Please contact support.');
      }

      // Validate file size (Whisper API has a 25MB limit)
      const maxSize = 25 * 1024 * 1024; // 25MB
      if (file.size > maxSize) {
        throw new Error(`Audio file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 25MB. Please compress the audio file and try again.`);
      }

      // Create FormData for Whisper API
      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json'); // Get timestamps and metadata
      formData.append('language', 'en'); // Default to English, can be auto-detected

      console.log('[DEBUG] Sending audio to Whisper API...');
      
      // Call OpenAI Whisper API
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[ERROR] Whisper API error:', errorData);
        throw new Error(`Audio transcription failed: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      const transcriptionData = await response.json();
      console.log('[DEBUG] Whisper transcription successful:', {
        duration: transcriptionData.duration,
        textLength: transcriptionData.text?.length,
        language: transcriptionData.language,
        segmentCount: transcriptionData.segments?.length
      });

      const transcriptText = transcriptionData.text;
      
      if (!transcriptText || transcriptText.trim().length < 10) {
        throw new Error('No speech detected in audio file or transcription too short. Please ensure the audio contains clear speech.');
      }

      // Format the transcript with metadata
      let processedText = `[Audio Recording: ${file.name}]

Audio Details:
- Duration: ${transcriptionData.duration ? `${Math.floor(transcriptionData.duration / 60)}:${(transcriptionData.duration % 60).toFixed(0).padStart(2, '0')}` : 'Unknown'}
- Language: ${transcriptionData.language || 'Detected automatically'}
- File Size: ${(file.size / 1024 / 1024).toFixed(2)} MB
- Format: ${file.type || 'Audio file'}

Transcript:
${transcriptText}

This audio transcript should be analyzed for:
- Key spoken concepts and ideas
- Important explanations and definitions
- Educational content and examples
- Discussion points and insights
- Lecture or presentation material`;

      return {
        type: 'audio',
        source: file.name,
        extractedText: processedText,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          wordCount: transcriptText.split(/\s+/).length,
          uploadDate: new Date().toISOString(),
          isAudioFile: true,
          audioMetadata: {
            duration: transcriptionData.duration,
            language: transcriptionData.language,
            transcriptionModel: 'whisper-1',
            segmentCount: transcriptionData.segments?.length || 0,
            confidence: 'high' // Whisper generally has high confidence
          },
          documentType: 'Audio Transcript',
          originalTranscript: transcriptText
        }
      };
    } catch (error) {
      console.error('Audio transcription error:', error);
      throw new Error(`Failed to transcribe audio file: ${error.message}`);
    }
  }

  // Detect file type and language from file extension
  detectLanguage(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const languageMap = {
      'js': 'JavaScript',
      'jsx': 'React/JavaScript',
      'ts': 'TypeScript', 
      'tsx': 'React/TypeScript',
      'py': 'Python',
      'cpp': 'C++',
      'c': 'C',
      'h': 'C/C++ Header',
      'java': 'Java',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'go': 'Go',
      'rs': 'Rust',
      'asm': 'Assembly',
      'sql': 'SQL',
      'html': 'HTML',
      'css': 'CSS',
      'json': 'JSON',
      'xml': 'XML',
      'yaml': 'YAML',
      'yml': 'YAML',
      'csv': 'CSV Data',
      'tsv': 'TSV Data',
      'docx': 'Word Document',
      'pptx': 'PowerPoint Presentation',
      'xlsx': 'Excel Spreadsheet',
      'pdf': 'PDF Document',
      'mp3': 'MP3 Audio',
      'wav': 'WAV Audio',
      'm4a': 'M4A Audio',
      'aac': 'AAC Audio',
      'ogg': 'OGG Audio',
      'flac': 'FLAC Audio',
      'wma': 'WMA Audio'
    };
    return languageMap[ext] || 'Unknown';
  }

  // Main processing method - handles any file type
  async processFile(file) {
    this.logExtractionStep('FILE_PROCESSING_START', {
      input: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        lastModified: file.lastModified
      },
      extractor: 'Universal file processor'
    });
    
    const fileType = file.type;
    const fileName = file.name.toLowerCase();
    let selectedExtractor = 'unknown';

    try {
      // Audio files - NEW FEATURE
      if (fileType.startsWith('audio/') || 
          fileName.match(/\.(mp3|wav|m4a|aac|ogg|flac|wma|mp4|mov|avi|webm)$/)) {
        selectedExtractor = 'Audio transcription (Whisper API)';
        this.logExtractionStep('FILE_ROUTE_AUDIO', { extractor: selectedExtractor });
        return await this.extractTextFromAudio(file);
      }

      // PDF files
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        selectedExtractor = 'PDF parser (PDF.js)';
        this.logExtractionStep('FILE_ROUTE_PDF', { extractor: selectedExtractor });
        return await this.extractTextFromPDF(file);
      }

      // Microsoft Office Documents
      // Word documents (.docx)
      if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
        selectedExtractor = 'Word document (mammoth)';
        this.logExtractionStep('FILE_ROUTE_WORD', { extractor: selectedExtractor });
        return await this.extractTextFromWord(file);
      }

      // PowerPoint presentations (.pptx)
      if (fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || fileName.endsWith('.pptx')) {
        selectedExtractor = 'PowerPoint presentation (PizZip)';
        this.logExtractionStep('FILE_ROUTE_POWERPOINT', { extractor: selectedExtractor });
        return await this.extractTextFromPowerPoint(file);
      }

      // Excel spreadsheets (.xlsx)
      if (fileType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || fileName.endsWith('.xlsx')) {
        selectedExtractor = 'Excel spreadsheet (PizZip)';
        this.logExtractionStep('FILE_ROUTE_EXCEL', { extractor: selectedExtractor });
        return await this.extractTextFromExcel(file);
      }

      // Legacy Office formats (.doc, .ppt, .xls) - not supported
      if (fileName.match(/\.(doc|ppt|xls)$/)) {
        const legacyFormat = fileName.split('.').pop().toUpperCase();
        const modernFormat = legacyFormat === 'DOC' ? 'DOCX' : 
                           legacyFormat === 'PPT' ? 'PPTX' : 'XLSX';
        this.logExtractionStep('FILE_LEGACY_FORMAT', {
          legacyFormat,
          modernFormat,
          error: 'Legacy format not supported'
        });
        throw new Error(`Legacy ${legacyFormat} format is not supported. Please save as ${modernFormat} format for full processing. Most Office applications can convert: File → Save As → ${modernFormat} format.`);
      }

      // CSV and TSV files
      if (fileType === 'text/csv' || fileName.endsWith('.csv') || 
          fileType === 'text/tsv' || fileName.endsWith('.tsv')) {
        selectedExtractor = 'CSV/TSV parser';
        this.logExtractionStep('FILE_ROUTE_CSV', { extractor: selectedExtractor });
        return await this.extractTextFromCSV(file);
      }

      // Images
      if (fileType.startsWith('image/')) {
        selectedExtractor = 'OCR image processing (Tesseract.js)';
        this.logExtractionStep('FILE_ROUTE_IMAGE', { extractor: selectedExtractor });
        return await this.extractTextFromImage(file);
      }

      // Text and code files
      if (fileType.startsWith('text/') || 
          fileName.match(/\.(txt|md|js|jsx|ts|tsx|py|cpp|c|h|java|cs|php|rb|go|rs|asm|sql|html|css|json|xml|yaml|yml)$/)) {
        selectedExtractor = 'Text/code file parser';
        this.logExtractionStep('FILE_ROUTE_TEXT', { extractor: selectedExtractor });
        return await this.extractTextFromTextFile(file);
      }

      // Fallback: try to read as text
      selectedExtractor = 'Fallback text reader';
      this.logExtractionStep('FILE_ROUTE_FALLBACK', { extractor: selectedExtractor });
      return await this.extractTextFromTextFile(file);

    } catch (error) {
      this.logExtractionStep('FILE_PROCESSING_ERROR', {
        error: error.message,
        stack: error.stack,
        fileName: file.name,
        fileSize: file.size,
        selectedExtractor
      });
      throw new Error(`Failed to process ${file.name}: ${error.message}`);
    }
  }

  // Process any website URL by scraping content
  async processWebURL(url) {
    this.logExtractionStep('WEB_START', {
      input: { url, type: 'Website URL' },
      extractor: 'Web scraper with CORS proxy'
    });
    
    try {
      // Validate URL format
      let validUrl;
      try {
        validUrl = new URL(url);
        this.logExtractionStep('WEB_URL_VALID', {
          hostname: validUrl.hostname,
          protocol: validUrl.protocol
        });
      } catch (urlError) {
        this.logExtractionStep('WEB_URL_INVALID', {
          error: urlError.message,
          url
        });
        throw new Error('Invalid URL format. Please enter a valid website URL.');
      }

      // Check if it's a YouTube URL and redirect to YouTube processing
      if (validUrl.hostname.includes('youtube.com') || validUrl.hostname.includes('youtu.be')) {
        this.logExtractionStep('WEB_YOUTUBE_REDIRECT', {
          message: 'Detected YouTube URL, redirecting to YouTube processor'
        });
        return await this.extractYouTubeTranscript(url);
      }

      // Fetch the webpage content
      this.logExtractionStep('WEB_FETCH_START', {
        message: 'Fetching webpage content via CORS proxy'
      });
      
      let response;
      try {
        // Use a CORS proxy for client-side requests
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        response = await fetch(proxyUrl);
        
        this.logExtractionStep('WEB_FETCH_RESPONSE', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch webpage: ${response.status} ${response.statusText}`);
        }
      } catch (fetchError) {
        this.logExtractionStep('WEB_FETCH_ERROR', {
          error: fetchError.message,
          stack: fetchError.stack
        });
        throw new Error(`Unable to access the website. This may be due to CORS restrictions or the site being unavailable. Error: ${fetchError.message}`);
      }

      const data = await response.json();
      const htmlContent = data.contents;
      
      this.logExtractionStep('WEB_CONTENT_RECEIVED', {
        hasContent: !!htmlContent,
        contentLength: htmlContent?.length || 0
      });
      
      if (!htmlContent) {
        throw new Error('No content received from the website.');
      }

      // Parse HTML and extract meaningful content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      
      // Remove script and style elements
      const scripts = doc.querySelectorAll('script, style, nav, footer, aside, .ad, .advertisement, .sidebar');
      scripts.forEach(el => el.remove());
      
      this.logExtractionStep('WEB_HTML_PARSED', {
        removedElements: scripts.length,
        message: 'Cleaned HTML and removed non-content elements'
      });
      
      // Extract title
      const title = doc.querySelector('title')?.textContent?.trim() || 'Web Page';
      
      // Extract main content areas
      let extractedText = '';
      
      // Try to find main content area first
      const mainContent = doc.querySelector('main, article, .content, .post, .entry, #content, #main');
      if (mainContent) {
        extractedText = this.extractTextFromElement(mainContent);
        this.logExtractionStep('WEB_MAIN_CONTENT_FOUND', {
          selector: 'main content area',
          textLength: extractedText.length
        });
      } else {
        // Fallback: extract from body
        extractedText = this.extractTextFromElement(doc.body);
        this.logExtractionStep('WEB_FALLBACK_CONTENT', {
          selector: 'document body',
          textLength: extractedText.length
        });
      }
      
      // Clean up the text
      extractedText = extractedText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();
      
      this.logExtractionStep('WEB_TEXT_CLEANED', {
        finalTextLength: extractedText.length,
        wordCount: extractedText.split(/\s+/).length,
        extractedTextPreview: extractedText.substring(0, 200) + '...'
      });
      
      if (!extractedText || extractedText.length < 50) {
        throw new Error('Unable to extract meaningful content from the webpage. The page may be mostly images, videos, or protected content.');
      }

      // Format the content for AI processing
      const processedText = `[Website: ${title}]

URL: ${url}
Extracted: ${new Date().toISOString()}

Content:
${extractedText}

This web content should be analyzed for:
- Key concepts and main ideas
- Important facts and information
- Educational content and explanations
- Structured knowledge and insights
- Actionable information and examples`;

      this.logExtractionStep('WEB_SUCCESS', {
        title: title,
        contentLength: extractedText.length,
        wordCount: extractedText.split(/\s+/).length,
        processedTextLength: processedText.length
      });

      return {
        type: 'web',
        source: title,
        extractedText: processedText,
        metadata: {
          originalUrl: url,
          title: title,
          wordCount: extractedText.split(/\s+/).length,
          extractionDate: new Date().toISOString(),
          contentLength: extractedText.length,
          isWebContent: true,
          documentType: 'Web Page'
        }
      };
    } catch (error) {
      this.logExtractionStep('WEB_ERROR', {
        error: error.message,
        stack: error.stack,
        url
      });
      throw new Error(`Failed to process website: ${error.message}`);
    }
  }

  // Helper method to extract clean text from DOM element
  extractTextFromElement(element) {
    if (!element) return '';
    
    let text = '';
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip text in script, style, and hidden elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_SKIP;
          
          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript'].includes(tagName)) {
            return NodeFilter.FILTER_SKIP;
          }
          
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return NodeFilter.FILTER_SKIP;
          }
          
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent.trim();
      if (nodeText) {
        text += nodeText + ' ';
      }
    }
    
    return text.trim();
  }

  // Process direct text input for instant AI generation
  async processDirectText(textContent, promptTitle = 'Custom Text Input') {
    try {
      console.log('[DEBUG] Processing direct text input:', {
        title: promptTitle,
        textLength: textContent.length
      });
      
      if (!textContent || textContent.trim().length < 10) {
        throw new Error('Text input is too short. Please provide at least 10 characters of meaningful content.');
      }

      const cleanText = textContent.trim();
      
      // Format the content for AI processing
      const processedText = `[Direct Text Input: ${promptTitle}]

Created: ${new Date().toISOString()}
Source: User-provided text content

Content:
${cleanText}

This text content should be analyzed for:
- Key concepts and main ideas
- Important information and facts
- Educational content and explanations
- Learning objectives and insights
- Practical applications and examples`;

      console.log('[DEBUG] Direct text processing successful:', {
        title: promptTitle,
        wordCount: cleanText.split(/\s+/).length
      });

      return {
        type: 'direct_text',
        source: promptTitle,
        extractedText: processedText,
        metadata: {
          title: promptTitle,
          wordCount: cleanText.split(/\s+/).length,
          creationDate: new Date().toISOString(),
          contentLength: cleanText.length,
          isDirectText: true,
          documentType: 'Direct Text Input',
          originalText: cleanText
        }
      };
    } catch (error) {
      console.error('Direct text processing error:', error);
      throw new Error(`Failed to process text input: ${error.message}`);
    }
  }

  // Process YouTube URL
  async processYouTubeURL(url) {
    return await this.extractYouTubeTranscript(url);
  }

  // Enhanced AI content generation with better prompting
  async generateAIContent(topicName, extractedContent, apiKey) {
    try {
      // Prepare context from all content
      const contentPieces = Array.isArray(extractedContent) ? extractedContent : [extractedContent];
      const combinedText = contentPieces.map(content => content.extractedText || content.content).join('\n\n');
      
      if (!combinedText.trim()) {
        throw new Error('No content available for AI processing');
      }

      // Enhanced system prompt for better content generation
      const systemPrompt = `You are an expert educational content creator and learning specialist. Your task is to analyze the provided content and generate high-quality, pedagogically sound study materials.

Create a comprehensive set of learning materials that test different cognitive levels:
- Knowledge/Recall: Basic facts and definitions
- Comprehension: Understanding and explanation
- Application: Using concepts in new situations  
- Analysis: Breaking down complex ideas
- Synthesis: Combining ideas creatively
- Evaluation: Making judgments and critiques

Format your response as valid JSON with this exact structure:
{
  "flashcards": [
    {
      "type": "flashcard",
      "front": "Clear, specific question or prompt",
      "back": "Comprehensive answer with examples",
      "difficulty": "easy|medium|hard",
      "category": "concept|definition|application|analysis"
    }
  ],
  "multipleChoice": [
    {
      "type": "multiple-choice", 
      "question": "Well-crafted question testing understanding",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Detailed explanation of why this answer is correct",
      "difficulty": "easy|medium|hard"
    }
  ],
  "openEnded": [
    {
      "type": "open-ended",
      "question": "Thought-provoking question requiring analysis",
      "sampleAnswer": "Example of a good response",
      "rubric": "Key points that should be addressed"
    }
  ],
  "summaries": [
    {
      "type": "summary",
      "title": "Key concept or section title",
      "content": "Concise summary of main points",
      "keyTerms": ["term1", "term2", "term3"]
    }
  ]
}`;

      const userPrompt = `Topic: ${topicName}

Content to analyze:
${combinedText}

Please generate comprehensive study materials based on this content:
- 12-15 flashcards covering key concepts (mix of difficulties)
- 8-10 multiple choice questions (testing different cognitive levels)
- 3-5 open-ended questions for deeper analysis
- 2-3 summary sections organizing the main ideas

Focus on:
1. Accuracy and pedagogical value
2. Clear, unambiguous language
3. Progressive difficulty levels
4. Practical application where relevant
5. Critical thinking development

Ensure all content is directly based on the provided material.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4.1',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 3000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response
      let generatedContent;
      try {
        generatedContent = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        throw new Error('Failed to parse AI response. Please try again.');
      }

      // Combine all generated content into a flat array for the question pool
      const allContent = [
        ...(generatedContent.flashcards || []),
        ...(generatedContent.multipleChoice || []),
        ...(generatedContent.openEnded || []),
        ...(generatedContent.summaries || [])
      ];

      if (allContent.length === 0) {
        throw new Error('No content was generated. Please try again.');
      }

      return {
        success: true,
        generated: allContent.length,
        content: allContent,
        breakdown: {
          flashcards: generatedContent.flashcards?.length || 0,
          multipleChoice: generatedContent.multipleChoice?.length || 0,
          openEnded: generatedContent.openEnded?.length || 0,
          summaries: generatedContent.summaries?.length || 0
        }
      };
    } catch (error) {
      console.error('AI content generation error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const fileProcessingService = new FileProcessingService(); 