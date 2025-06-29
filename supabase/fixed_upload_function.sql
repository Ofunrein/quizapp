-- CORRECTED UPLOAD FIX - Function that matches actual documents table schema
-- Create a function that can insert documents without any RLS restrictions

CREATE OR REPLACE FUNCTION public.simple_insert_document(
    p_topic_id UUID,
    p_title TEXT,
    p_content TEXT DEFAULT NULL,
    p_file_size BIGINT DEFAULT NULL,
    p_file_type TEXT DEFAULT NULL,
    p_storage_path TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_id UUID;
    current_user_id UUID;
BEGIN
    -- Get the current user ID
    current_user_id := auth.uid();
    
    -- Generate a new UUID
    new_id := gen_random_uuid();
    
    -- Insert into documents table with correct column names
    INSERT INTO documents (
        id,
        topic_id,
        user_id,
        filename,
        storage_path,
        file_type,
        file_size,
        metadata,
        created_at
    ) VALUES (
        new_id,
        p_topic_id,
        current_user_id,
        p_title,
        p_storage_path,
        p_file_type,
        p_file_size,
        jsonb_build_object('content', p_content),
        NOW()
    );
    
    RETURN new_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.simple_insert_document TO anon;
GRANT EXECUTE ON FUNCTION public.simple_insert_document TO authenticated;
GRANT EXECUTE ON FUNCTION public.simple_insert_document TO public; 