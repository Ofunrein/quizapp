-- Enhanced Schema: Source Tracking and Generation History
-- Run this after the main schema.sql to add history tracking capabilities

-- Create sources table to track all ingested content
CREATE TABLE IF NOT EXISTS sources (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NULL, -- NULL for YouTube content
  
  -- Source identification
  source_type TEXT NOT NULL, -- 'file', 'youtube', 'text'
  source_name TEXT NOT NULL, -- filename or YouTube URL or title
  original_name TEXT, -- original filename for files
  
  -- Processing metadata
  file_type TEXT, -- MIME type for files
  file_size INTEGER, -- size in bytes for files
  word_count INTEGER, -- extracted word count
  processing_status TEXT DEFAULT 'completed', -- 'processing', 'completed', 'failed'
  
  -- Source-specific metadata
  metadata JSONB DEFAULT '{}', -- file metadata, YouTube video info, etc.
  
  -- Timestamps
  ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Content reference
  knowledge_base_id UUID REFERENCES knowledge_base(id) ON DELETE SET NULL
);

-- Create generations table to track all AI-generated content
CREATE TABLE IF NOT EXISTS generations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  topic_id UUID REFERENCES topics(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Generation metadata
  generation_type TEXT NOT NULL, -- 'bulk', 'single', 'regeneration'
  ai_model TEXT DEFAULT 'gpt-4', -- AI model used
  prompt_version TEXT DEFAULT 'v1', -- for tracking prompt improvements
  
  -- Generation results
  items_generated INTEGER DEFAULT 0,
  breakdown JSONB DEFAULT '{}', -- count by type: {flashcards: 5, multiple_choice: 3, etc.}
  
  -- Source attribution - which sources were used
  source_ids UUID[] DEFAULT '{}', -- array of source IDs used for generation
  
  -- Generation status
  status TEXT DEFAULT 'completed', -- 'processing', 'completed', 'failed'
  error_message TEXT,
  
  -- Timestamps
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Performance metrics
  processing_time_ms INTEGER, -- how long generation took
  tokens_used INTEGER -- for cost tracking
);

-- Create generation_items table to link generated questions to their generation batch
CREATE TABLE IF NOT EXISTS generation_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  generation_id UUID REFERENCES generations(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  
  -- Item metadata
  item_type TEXT NOT NULL, -- 'flashcard', 'multiple-choice', 'open-ended', 'summary'
  item_title TEXT, -- extracted title/front of card/question
  difficulty TEXT, -- 'easy', 'medium', 'hard'
  
  -- Source attribution for this specific item
  derived_from_sources UUID[] DEFAULT '{}', -- specific sources this item was derived from
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create topic_history view for easy querying
CREATE OR REPLACE VIEW topic_history AS
SELECT 
  'source' as entry_type,
  s.id as entry_id,
  s.topic_id,
  s.user_id,
  s.source_name as title,
  s.source_type as type,
  s.metadata,
  s.ingested_at as timestamp,
  s.word_count,
  NULL as generation_id,
  NULL as items_count,
  NULL as source_ids
FROM sources s

UNION ALL

SELECT 
  'generation' as entry_type,
  g.id as entry_id,
  g.topic_id,
  g.user_id,
  CONCAT('AI Generation - ', g.items_generated, ' items') as title,
  g.generation_type as type,
  g.breakdown as metadata,
  g.completed_at as timestamp,
  NULL as word_count,
  g.id as generation_id,
  g.items_generated as items_count,
  g.source_ids
FROM generations g
WHERE g.status = 'completed'

ORDER BY timestamp DESC;

-- Add RLS policies for new tables
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_items ENABLE ROW LEVEL SECURITY;

-- Sources policies
CREATE POLICY "Users can view their own sources" ON sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own sources" ON sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own sources" ON sources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own sources" ON sources
  FOR DELETE USING (auth.uid() = user_id);

-- Generations policies
CREATE POLICY "Users can view their own generations" ON generations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own generations" ON generations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own generations" ON generations
  FOR UPDATE USING (auth.uid() = user_id);

-- Generation items policies
CREATE POLICY "Users can view their own generation items" ON generation_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM generations g 
      WHERE g.id = generation_items.generation_id 
      AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create their own generation items" ON generation_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM generations g 
      WHERE g.id = generation_items.generation_id 
      AND g.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sources_topic_id ON sources(topic_id);
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_ingested_at ON sources(ingested_at);
CREATE INDEX IF NOT EXISTS idx_sources_source_type ON sources(source_type);

CREATE INDEX IF NOT EXISTS idx_generations_topic_id ON generations(topic_id);
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_completed_at ON generations(completed_at);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);

CREATE INDEX IF NOT EXISTS idx_generation_items_generation_id ON generation_items(generation_id);
CREATE INDEX IF NOT EXISTS idx_generation_items_question_id ON generation_items(question_id);

-- Add source tracking to existing questions table
ALTER TABLE questions 
ADD COLUMN IF NOT EXISTS generation_id UUID REFERENCES generations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source_attribution UUID[] DEFAULT '{}';

-- Create index for question source attribution
CREATE INDEX IF NOT EXISTS idx_questions_generation_id ON questions(generation_id);
CREATE INDEX IF NOT EXISTS idx_questions_source_attribution ON questions USING GIN(source_attribution); 