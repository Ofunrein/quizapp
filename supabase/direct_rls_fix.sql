-- URGENT: Direct RLS Fix for Documents Table
-- This fixes the YouTube upload RLS violation

-- First, ensure RLS is enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Remove all existing policies completely
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents; 
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- Create simple, working policies
CREATE POLICY "documents_select_policy" ON documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "documents_insert_policy" ON documents  
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_update_policy" ON documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "documents_delete_policy" ON documents
    FOR DELETE USING (auth.uid() = user_id);

-- Grant explicit permissions
GRANT ALL ON documents TO authenticated;
GRANT ALL ON documents TO anon;

-- Make storage_path nullable for text content
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;

-- Add new columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'content_text') THEN
        ALTER TABLE documents ADD COLUMN content_text TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'source_type') THEN
        ALTER TABLE documents ADD COLUMN source_type TEXT DEFAULT 'file';
    END IF;
END $$; 