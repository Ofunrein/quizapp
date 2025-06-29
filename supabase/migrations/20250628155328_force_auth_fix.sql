-- Force auth fix - ensure authentication functions work properly

-- Grant anon role ability to use auth functions
GRANT USAGE ON SCHEMA auth TO anon;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon;
GRANT EXECUTE ON FUNCTION auth.jwt() TO anon;

-- Ensure authenticated role has all necessary permissions
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;

-- Double-check documents table permissions
GRANT ALL ON documents TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create a simple test to verify auth is working
CREATE OR REPLACE FUNCTION public.test_auth()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN jsonb_build_object(
        'user_id', auth.uid(),
        'has_user', auth.uid() IS NOT NULL,
        'role', current_setting('request.jwt.claim.role', true)
    );
END;
$$;

-- Grant execute on test function
GRANT EXECUTE ON FUNCTION public.test_auth() TO anon;
GRANT EXECUTE ON FUNCTION public.test_auth() TO authenticated;
