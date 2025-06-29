-- FINAL RLS FIX - Complete solution for row-level security issues
-- This script completely rebuilds the RLS policies to ensure they work correctly

-- Step 1: Disable RLS temporarily to clean up
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies completely
DROP POLICY IF EXISTS "documents_select_policy" ON documents;
DROP POLICY IF EXISTS "documents_insert_policy" ON documents;
DROP POLICY IF EXISTS "documents_update_policy" ON documents;
DROP POLICY IF EXISTS "documents_delete_policy" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can create their own documents" ON documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

-- Step 3: Ensure the table has proper structure
-- Make storage_path nullable for text content
ALTER TABLE documents ALTER COLUMN storage_path DROP NOT NULL;

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add content_text column for direct text storage
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'content_text') THEN
        ALTER TABLE documents ADD COLUMN content_text TEXT;
    END IF;
    
    -- Add source_type column to distinguish content types
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'documents' AND column_name = 'source_type') THEN
        ALTER TABLE documents ADD COLUMN source_type TEXT DEFAULT 'file';
    END IF;
END $$;

-- Step 4: Create simple, working RLS policies
-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Create policies that actually work
CREATE POLICY "documents_select" ON documents
    FOR SELECT 
    USING (user_id = auth.uid());

CREATE POLICY "documents_insert" ON documents
    FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_update" ON documents
    FOR UPDATE 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "documents_delete" ON documents
    FOR DELETE 
    USING (user_id = auth.uid());

-- Step 5: Grant necessary permissions
GRANT ALL ON documents TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Step 6: Fix any existing documents without user_id
-- This updates any orphaned documents (shouldn't happen but just in case)
UPDATE documents 
SET user_id = (
    SELECT auth.uid() 
    FROM auth.users 
    LIMIT 1
) 
WHERE user_id IS NULL;

-- Step 7: Ensure user_id is NOT NULL going forward
ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;

-- Step 8: Create index for better performance
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_topic_user ON documents(topic_id, user_id);

-- Step 9: Verify the policies work
-- Test query (this should work for authenticated users)
-- SELECT * FROM documents WHERE user_id = auth.uid();

-- Step 10: Display current policies for verification
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'documents'; 