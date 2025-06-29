-- Verify and fix RLS policies for documents table
-- This migration ensures the policies are correctly applied

-- First, check if the documents table has the correct structure
DO $$
BEGIN
    -- Ensure user_id column exists and is not null
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'documents' AND column_name = 'user_id' AND is_nullable = 'NO'
    ) THEN
        -- Make user_id NOT NULL if it isn't already
        ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Drop and recreate the INSERT policy to ensure it's correct
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;

-- Create a very simple and explicit INSERT policy
CREATE POLICY "documents_insert_policy" ON documents
    FOR INSERT 
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Verify the policy exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'documents' 
        AND policyname = 'documents_insert_policy'
        AND schemaname = 'public'
    ) THEN
        RAISE EXCEPTION 'INSERT policy was not created successfully';
    END IF;
END $$;

-- Grant explicit permissions (in case they're missing)
GRANT INSERT ON documents TO authenticated;
GRANT SELECT ON documents TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Also ensure the sequence permissions are granted
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify RLS is enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'documents' 
        AND n.nspname = 'public'
        AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create a simple function to check auth context (without type issues)
CREATE OR REPLACE FUNCTION check_auth_context()
RETURNS TEXT
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    RETURN COALESCE(auth.uid()::text, 'NO_USER_ID');
END;
$$;

-- Log the current policies for verification
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'documents' AND schemaname = 'public'
ORDER BY policyname;
