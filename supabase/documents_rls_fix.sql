-- Fix Documents Table RLS Policies
-- This ensures YouTube transcript uploads work correctly

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
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

-- Verify RLS is enabled (should already be enabled from schema.sql)
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO authenticated;
GRANT USAGE ON SEQUENCE documents_id_seq TO authenticated;

-- Also ensure storage permissions are properly set
-- Note: Storage policies need to be set via Supabase dashboard or storage_setup.sql 