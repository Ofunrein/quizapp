# File Processing Debug Guide

## Current Status
✅ **Text content processing works** - Notifications show successful text processing
❌ **File processing fails** - Shows "Failed to process file: Unknown error occurred"

## Debugging Steps

### Step 1: Load Debug Tools
Copy and paste this script into the browser console:

```javascript
// Load the file upload debug script
const script = document.createElement('script');
script.src = './test-file-upload.js';
document.head.appendChild(script);
```

### Step 2: Test File Processing Service Only
Run this in the console to test just the extraction:

```javascript
window.testFileProcessingOnly()
```

**Expected Result:**
- ✅ Should extract text from a simple .txt file
- ✅ Should return word count and metadata

**If this fails:**
- Check for missing dependencies (pdf-parse, mammoth, tesseract.js)
- Check console for import errors
- Check if file processing service is properly exported

### Step 3: Test Complete File Upload Pipeline
Run this in the console:

```javascript
window.testFileUpload()
```

**Expected Result:**
- ✅ Should upload file to storage
- ✅ Should save document metadata
- ✅ Should create knowledge base entry
- ✅ Should create source tracking entry

**If this fails:**
- Check authentication (must be signed in)
- Check RLS policies in Supabase
- Check storage bucket permissions

### Step 4: Check Console Logs
Look for these specific log patterns:

**Success Logs:**
```
[EXTRACTION-DEBUG] Starting file processing for: {...}
[EXTRACTION-DEBUG] File processing successful: {...}
[EXTRACTION-DEBUG] File upload successful: {...}
```

**Error Logs:**
```
[EXTRACTION-ERROR] File processing failed: {...}
[ERROR] Ingestion failed: {...}
```

### Step 5: Check Network Tab
Look for failed requests to:
- `/storage/v1/object/documents/...` (file upload)
- `/rest/v1/documents` (metadata save)
- `/rest/v1/knowledge_base` (content save)
- `/rest/v1/sources` (source tracking)

## Common Issues and Solutions

### Issue 1: "fileProcessingService is not defined"
**Solution:** Check imports in `supabaseService.js`
```javascript
import { fileProcessingService } from './fileProcessingService';
```

### Issue 2: "User not authenticated"
**Solution:** 
1. Sign out and sign back in
2. Check if `window.dataService.user` exists
3. Check Supabase auth session

### Issue 3: "RLS Policy Violation" 
**Solution:**
1. Check user_id is being set in database inserts
2. Verify RLS policies allow user access
3. Check if user has proper permissions

### Issue 4: "Failed to process file: undefined"
**Solution:** This was fixed in the recent update - should now show specific error messages

### Issue 5: Storage upload fails
**Solution:**
1. Check storage bucket exists and is public
2. Check RLS policies on storage
3. Check file size limits

## Manual Testing Steps

### Test 1: Simple Text File
1. Create a simple .txt file with "Hello World"
2. Upload through the UI
3. Check console for debug logs

### Test 2: Markdown File
1. Create a .md file with headers and content
2. Upload through the UI
3. Verify text extraction works

### Test 3: Large File
1. Create a file > 1MB
2. Test upload and processing
3. Check for timeout or size limit errors

## Verification Checklist

After successful upload, verify:
- [ ] Document appears in topic's document list
- [ ] Knowledge base entry created with extracted text
- [ ] Source tracking entry created
- [ ] File accessible via signed URL
- [ ] Word count calculated correctly
- [ ] Metadata saved properly

## Debug Commands Reference

```javascript
// Check service availability
window.checkServices()

// Test file processing only
window.testFileProcessingOnly()

// Test complete upload pipeline
window.testFileUpload()

// Check for console errors
window.checkConsoleErrors()

// Quick diagnostic
window.quickDiagnostic()
```

## Expected Debug Output

**Successful File Processing:**
```
🧪 Testing file processing service only...
✅ File processing service imported
📄 Processing test file...
✅ File processing SUCCESS: {
  type: "text",
  source: "test.txt", 
  textLength: 44,
  wordCount: 9
}
```

**Successful File Upload:**
```
🧪 Testing file upload process...
✅ User authenticated: user@example.com
✅ Topics loaded: 3
📁 Using topic: Test Topic abc123
📄 Created test file: { name: "test-upload.md", type: "text/markdown", size: 234 }
🔄 Starting file ingestion...
✅ File ingestion SUCCESS: {
  success: true,
  documentId: "doc123",
  sourceId: "src456", 
  wordCount: 35,
  processed: true
}
```

## Next Steps

1. **If file processing service works but upload fails:** Focus on storage/database issues
2. **If file processing service fails:** Check library dependencies and imports
3. **If authentication errors:** Check RLS policies and user permissions
4. **If unknown errors persist:** Check browser network tab for specific HTTP errors

## Contact Information

If issues persist after following this guide:
1. Share console logs from the debug commands
2. Share network tab errors
3. Share specific error messages from notifications 