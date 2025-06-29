-- Fix missing UPDATE policy for documents table
-- This allows users to update their own documents (needed for source name editing)

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Also ensure the storage_path can be NULL for non-file content (YouTube, web, text)
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL; 