# Database Setup Instructions

## 🚨 **Current Issue: Database Tables Missing**

You're signed in successfully, but getting "Error Loading Topics" because the database tables haven't been created yet.

## 📋 **Quick Setup Steps**

### 1. **Go to your Supabase Dashboard**
- Visit: https://supabase.com/dashboard
- Select your project: `klykrhpstgpeopdsraba`

### 2. **Run Database Schema**
- Click "SQL Editor" in the left sidebar
- Click "New SQL Snippet" 
- Copy and paste the contents of `supabase/schema.sql`
- Click "Run" to create all tables

### 3. **Set Up Storage Bucket**
- Copy and paste the contents of `supabase/storage_setup.sql`
- Click "Run" to create the documents bucket and policies

### 4. **Verify Setup**
- Go to "Table Editor" and confirm you see these tables:
  - `topics`
  - `documents` 
  - `knowledge_base`
  - `questions`
  - `practice_tests`
  - `test_results`
  - `flashcard_progress`
  - `study_progress`

- Go to "Storage" and confirm you see:
  - `documents` bucket

## 🔧 **Alternative: Copy-Paste SQL**

If you prefer, here's the complete SQL to run in one go:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create topics table
CREATE TABLE topics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table for file storage tracking
CREATE TABLE documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create knowledge_base table (updated to reference documents)
CREATE TABLE knowledge_base (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create questions table
CREATE TABLE questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  question_data JSONB NOT NULL,
  is_saved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create practice_tests table
CREATE TABLE practice_tests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_ids UUID[] NOT NULL,
  duration INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create test_results table
CREATE TABLE test_results (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  test_id UUID REFERENCES practice_tests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL,
  score INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flashcard_progress table
CREATE TABLE flashcard_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reviews INTEGER DEFAULT 0,
  last_review TIMESTAMP WITH TIME ZONE,
  next_review TIMESTAMP WITH TIME ZONE,
  interval FLOAT DEFAULT 1,
  UNIQUE(question_id, user_id)
);

-- Create study_progress table
CREATE TABLE study_progress (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  result BOOLEAN NOT NULL,
  type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create RLS policies
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE practice_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;

-- Topics policies
CREATE POLICY "Users can view their own topics" ON topics
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own topics" ON topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own topics" ON topics
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own topics" ON topics
  FOR DELETE USING (auth.uid() = user_id);

-- Documents policies
CREATE POLICY "Users can view their own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- Knowledge base policies
CREATE POLICY "Users can view their own knowledge base" ON knowledge_base
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own knowledge base" ON knowledge_base
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Questions policies
CREATE POLICY "Users can view their own questions" ON questions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own questions" ON questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own questions" ON questions
  FOR UPDATE USING (auth.uid() = user_id);

-- Practice tests policies
CREATE POLICY "Users can view their own tests" ON practice_tests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tests" ON practice_tests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Test results policies
CREATE POLICY "Users can view their own test results" ON test_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own test results" ON test_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Flashcard progress policies
CREATE POLICY "Users can view their own flashcard progress" ON flashcard_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own flashcard progress" ON flashcard_progress
  FOR ALL USING (auth.uid() = user_id);

-- Study progress policies
CREATE POLICY "Users can view their own study progress" ON study_progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own study progress" ON study_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_topics_user_id ON topics(user_id);
CREATE INDEX idx_documents_topic_id ON documents(topic_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_knowledge_base_topic_id ON knowledge_base(topic_id);
CREATE INDEX idx_knowledge_base_document_id ON knowledge_base(document_id);
CREATE INDEX idx_questions_topic_id ON questions(topic_id);
CREATE INDEX idx_questions_is_saved ON questions(is_saved);
CREATE INDEX idx_practice_tests_topic_id ON practice_tests(topic_id);
CREATE INDEX idx_flashcard_progress_next_review ON flashcard_progress(next_review);
CREATE INDEX idx_study_progress_topic_id ON study_progress(topic_id);

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documents', 'documents', false);

-- Create storage policies for documents bucket
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND 
    auth.uid()::text = (storage.foldername(name))[2]
  );

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
```

## ✅ **After Running the SQL**

1. Refresh your QuizMaster app at http://localhost:3001
2. The "Error Loading Topics" should be gone
3. You should see an empty dashboard ready to create topics
4. Try creating a topic to test everything works!

## 🔍 **If Still Having Issues**

Check the browser console (F12 → Console) for any error messages and let me know what you see. 