-- SIMPLEST POSSIBLE RLS FIX
-- This is the most basic implementation that should work

-- First, completely reset the documents table policies
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;

-- Drop ALL policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'documents' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON documents', pol.policyname);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create the absolute simplest policies possible
-- No fancy optimizations, just basic auth.uid() = user_id checks

CREATE POLICY "allow_select" ON documents
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "allow_insert" ON documents
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_update" ON documents
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_delete" ON documents
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Ensure permissions are granted
GRANT ALL ON documents TO authenticated;

-- Test that it works by creating a test function
CREATE OR REPLACE FUNCTION test_documents_insert(test_topic_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
    result TEXT;
BEGIN
    -- This function tests if an authenticated user can insert
    IF auth.uid() IS NULL THEN
        RETURN 'ERROR: No authenticated user';
    END IF;
    
    -- Try to insert a test document
    INSERT INTO documents (
        topic_id,
        user_id,
        filename,
        file_type,
        source_type
    ) VALUES (
        test_topic_id,
        auth.uid(),
        'test_document.txt',
        'text/plain',
        'test'
    );
    
    RETURN 'SUCCESS: Document inserted';
EXCEPTION
    WHEN OTHERS THEN
        RETURN 'ERROR: ' || SQLERRM;
END;
$$;
