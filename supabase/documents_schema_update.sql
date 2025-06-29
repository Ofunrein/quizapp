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