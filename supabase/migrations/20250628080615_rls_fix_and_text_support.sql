-- Fix Documents Table RLS Policies and Add Text Support
-- Ensures YouTube transcript uploads and text ingestion work correctly

-- Enable RLS on documents table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- Create comprehensive RLS policies for documents table
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated;

-- Update documents table to support text content without storage
-- This allows direct text ingestion without file upload

-- Make storage_path nullable for text content
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;

-- Add content_text column for direct text storage
ALTER TABLE documents ADD COLUMN IF NOT EXISTS content_text TEXT;

-- Add source_type column to distinguish between file uploads and text content
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'file';

-- Update existing records to have source_type = 'file'
UPDATE documents SET source_type = 'file' WHERE source_type IS NULL;
