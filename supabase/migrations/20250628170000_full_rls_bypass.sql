-- Full RLS bypass and comprehensive policies
-- This ensures all operations work without permission issues

-- First, ensure all necessary policies exist for documents table
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- Create comprehensive document policies
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Ensure storage_path can be NULL for non-file content
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;

-- Add source_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documents' AND column_name='source_type') THEN
        ALTER TABLE documents ADD COLUMN source_type TEXT;
    END IF;
END $$;

-- Add source column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documents' AND column_name='source') THEN
        ALTER TABLE documents ADD COLUMN source TEXT;
    END IF;
END $$;

-- Grant additional permissions to authenticated role
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Ensure auth functions are accessible
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;

-- Create a debug function to test RLS
CREATE OR REPLACE FUNCTION public.debug_rls()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    doc_count integer;
    result jsonb;
BEGIN
    current_user_id := auth.uid();
    
    SELECT COUNT(*) INTO doc_count 
    FROM documents 
    WHERE user_id = current_user_id;
    
    result := jsonb_build_object(
        'user_id', current_user_id,
        'has_user', current_user_id IS NOT NULL,
        'role', current_setting('request.jwt.claim.role', true),
        'document_count', doc_count,
        'can_insert', (SELECT has_table_privilege('documents', 'INSERT')),
        'can_update', (SELECT has_table_privilege('documents', 'UPDATE')),
        'can_delete', (SELECT has_table_privilege('documents', 'DELETE')),
        'can_select', (SELECT has_table_privilege('documents', 'SELECT'))
    );
    
    RETURN result;
END;
$$;

-- Grant execute on debug function
GRANT EXECUTE ON FUNCTION public.debug_rls() TO authenticated;
GRANT EXECUTE ON FUNCTION public.debug_rls() TO anon; 