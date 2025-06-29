// Simple API endpoint for topic history
// This can be used for external integrations or API access

import { supabaseService } from '../services/supabaseService.js';

/**
 * GET /api/topics/:id/history
 * Returns the complete history of sources and generations for a topic
 */
export async function getTopicHistory(topicId, userId) {
  try {
    // Validate inputs
    if (!topicId) {
      throw new Error('Topic ID is required');
    }
    
    if (!userId) {
      throw new Error('User authentication required');
    }

    // Get comprehensive history data
    const [history, generations, sources] = await Promise.all([
      supabaseService.getTopicHistory(topicId),
      supabaseService.getGenerationHistory(topicId),
      supabaseService.getSourcesWithStats(topicId)
    ]);

    // Format response
    const response = {
      topicId,
      timestamp: new Date().toISOString(),
      summary: {
        totalSources: sources.length,
        totalGenerations: generations.length,
        totalWords: sources.reduce((sum, s) => sum + (s.word_count || 0), 0),
        totalGeneratedItems: sources.reduce((sum, s) => sum + s.generatedItemsCount, 0)
      },
      timeline: history.map(entry => ({
        id: entry.entry_id,
        type: entry.entry_type,
        title: entry.title,
        category: entry.type,
        timestamp: entry.timestamp,
        metadata: entry.metadata,
        ...(entry.entry_type === 'source' && {
          wordCount: entry.word_count,
          sourceType: entry.type
        }),
        ...(entry.entry_type === 'generation' && {
          itemsGenerated: entry.items_count,
          sourceIds: entry.source_ids
        })
      })),
      sources: sources.map(source => ({
        id: source.id,
        name: source.source_name,
        originalName: source.original_name,
        type: source.source_type,
        fileType: source.file_type,
        fileSize: source.file_size,
        wordCount: source.word_count,
        ingestedAt: source.ingested_at,
        processedAt: source.processed_at,
        generatedItemsCount: source.generatedItemsCount,
        metadata: source.metadata
      })),
      generations: generations.map(gen => ({
        id: gen.id,
        type: gen.generation_type,
        model: gen.ai_model,
        status: gen.status,
        itemsGenerated: gen.items_generated,
        breakdown: gen.breakdown,
        sourceIds: gen.source_ids,
        startedAt: gen.started_at,
        completedAt: gen.completed_at,
        processingTimeMs: gen.processing_time_ms,
        items: gen.generation_items?.map(item => ({
          id: item.id,
          type: item.item_type,
          title: item.item_title,
          difficulty: item.difficulty,
          derivedFromSources: item.derived_from_sources,
          createdAt: item.created_at,
          isSaved: item.questions?.is_saved || false
        })) || []
      }))
    };

    return {
      success: true,
      data: response
    };

  } catch (error) {
    console.error('API Error - getTopicHistory:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Express.js route handler (if using Express)
 */
export function createExpressHandler() {
  return async (req, res) => {
    try {
      const { id: topicId } = req.params;
      const userId = req.user?.id; // Assumes auth middleware sets req.user
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const result = await getTopicHistory(topicId, userId);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  };
}

/**
 * Fetch API wrapper for client-side usage
 */
export async function fetchTopicHistory(topicId, options = {}) {
  try {
    const { baseUrl = '', headers = {} } = options;
    
    const response = await fetch(`${baseUrl}/api/topics/${topicId}/history`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Example usage documentation
 */
export const apiDocumentation = {
  endpoint: 'GET /api/topics/:id/history',
  description: 'Retrieve complete history of sources and AI generations for a topic',
  authentication: 'Required - Bearer token or session',
  parameters: {
    path: {
      id: 'UUID - Topic identifier'
    }
  },
  response: {
    success: 'boolean',
    data: {
      topicId: 'string',
      timestamp: 'ISO 8601 timestamp',
      summary: {
        totalSources: 'number',
        totalGenerations: 'number', 
        totalWords: 'number',
        totalGeneratedItems: 'number'
      },
      timeline: 'array of chronological events',
      sources: 'array of source details',
      generations: 'array of AI generation details'
    }
  },
  examples: {
    curl: `curl -H "Authorization: Bearer <token>" \\
     https://yourapp.com/api/topics/123e4567-e89b-12d3-a456-426614174000/history`,
    javascript: `const history = await fetchTopicHistory('123e4567-e89b-12d3-a456-426614174000', {
  baseUrl: 'https://yourapp.com',
  headers: { 'Authorization': 'Bearer <token>' }
});`
  }
};

export default {
  getTopicHistory,
  createExpressHandler,
  fetchTopicHistory,
  apiDocumentation
}; 