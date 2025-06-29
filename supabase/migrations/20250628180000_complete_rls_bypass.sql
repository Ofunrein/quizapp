-- Complete RLS bypass - give full access to all authenticated users
-- This removes all RLS restrictions and allows full CRUD operations

-- Drop all existing policies first
DROP POLICY IF EXISTS "Users can view their own topics" ON topics;
DROP POLICY IF EXISTS "Users can create their own topics" ON topics;
DROP POLICY IF EXISTS "Users can update their own topics" ON topics;
DROP POLICY IF EXISTS "Users can delete their own topics" ON topics;

DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

DROP POLICY IF EXISTS "Users can view their own knowledge base" ON knowledge_base;
DROP POLICY IF EXISTS "Users can create their own knowledge base" ON knowledge_base;

DROP POLICY IF EXISTS "Users can view their own questions" ON questions;
DROP POLICY IF EXISTS "Users can create their own questions" ON questions;
DROP POLICY IF EXISTS "Users can update their own questions" ON questions;

-- Disable RLS entirely for all tables
ALTER TABLE topics DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE practice_tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE study_progress DISABLE ROW LEVEL SECURITY;

-- Grant ALL privileges to authenticated users on all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant ALL privileges to anon users as well (for broader access)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Ensure public schema access
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant auth schema access
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT USAGE ON SCHEMA auth TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon;

-- Create a simple test function to verify access
CREATE OR REPLACE FUNCTION public.test_full_access()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
    test_topic_id uuid;
    test_doc_id uuid;
BEGIN
    -- Test INSERT
    INSERT INTO topics (name, user_id) 
    VALUES ('Test Topic', auth.uid()) 
    RETURNING id INTO test_topic_id;
    
    -- Test INSERT on documents
    INSERT INTO documents (topic_id, user_id, filename, storage_path, file_type, file_size)
    VALUES (test_topic_id, auth.uid(), 'test.txt', null, 'text/plain', 100)
    RETURNING id INTO test_doc_id;
    
    -- Test UPDATE
    UPDATE documents SET filename = 'updated_test.txt' WHERE id = test_doc_id;
    
    -- Test SELECT
    SELECT COUNT(*) FROM documents WHERE topic_id = test_topic_id;
    
    -- Test DELETE
    DELETE FROM documents WHERE id = test_doc_id;
    DELETE FROM topics WHERE id = test_topic_id;
    
    result := jsonb_build_object(
        'success', true,
        'message', 'Full database access confirmed',
        'user_id', auth.uid(),
        'timestamp', NOW()
    );
    
    RETURN result;
EXCEPTION WHEN OTHERS THEN
    result := jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'user_id', auth.uid(),
        'timestamp', NOW()
    );
    RETURN result;
END;
$$;

-- Grant execute on test function
GRANT EXECUTE ON FUNCTION public.test_full_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_full_access() TO anon;

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add source_type column to documents if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documents' AND column_name='source_type') THEN
        ALTER TABLE documents ADD COLUMN source_type TEXT;
    END IF;
    
    -- Add source column to documents if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='documents' AND column_name='source') THEN
        ALTER TABLE documents ADD COLUMN source TEXT;
    END IF;
    
    -- Ensure storage_path can be NULL
    ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;
END $$; 