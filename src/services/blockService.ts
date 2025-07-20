/**
 * Block Service - CRUD operations and tree management for block-based content
 */

import { supabase } from "@/integrations/supabase/client";
import type {
  Block,
  BlockType,
  BlockProps,
  CreateBlockRequest,
  UpdateBlockRequest,
  BlockTreeNode,
  BlockSearchResult,
  Note,
  NoteWithMetadata
} from "@/types/blocks";

/**
 * Create a new block
 */
export const createBlock = async (request: CreateBlockRequest): Promise<string> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    // If no position specified, add at end
    let position = request.position;
    if (!position) {
      const { data: lastBlock } = await supabase
        .from("blocks")
        .select("position")
        .eq("note_id", request.note_id)
        .eq("parent_id", request.parent_id || null)
        .order("position", { ascending: false })
        .limit(1)
        .single();
      
      position = lastBlock ? lastBlock.position + 1 : 1;
    }

    const blockData = {
      user_id: user.user.id,
      note_id: request.note_id,
      parent_id: request.parent_id || null,
      position,
      type: request.type,
      props: request.props,
      audio_timestamp: request.audio_timestamp || null,
      ai_generated: request.ai_generated || false,
    };

    const { data, error } = await supabase
      .from("blocks")
      .insert(blockData)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating block:", error);
      throw new Error(`Failed to create block: ${error.message}`);
    }

    return data.id;
  } catch (error) {
    console.error("Error in createBlock:", error);
    throw error;
  }
};

/**
 * Get a single block by ID
 */
export const getBlock = async (blockId: string): Promise<Block | null> => {
  try {
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .eq("id", blockId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // Not found
      console.error("Error fetching block:", error);
      throw new Error(`Failed to fetch block: ${error.message}`);
    }

    return data;
  } catch (error) {
    console.error("Error in getBlock:", error);
    throw error;
  }
};

/**
 * Get all blocks for a note in tree order
 */
export const getBlocksForNote = async (noteId: string): Promise<Block[]> => {
  try {
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .eq("note_id", noteId)
      .order("parent_id", { nullsFirst: true })
      .order("position");

    if (error) {
      console.error("Error fetching blocks for note:", error);
      throw new Error(`Failed to fetch blocks: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getBlocksForNote:", error);
    throw error;
  }
};

/**
 * Get blocks in hierarchical tree structure
 */
export const getBlockTree = async (noteId: string): Promise<BlockTreeNode[]> => {
  try {
    const { data, error } = await supabase
      .from("block_tree")
      .select("*")
      .eq("note_id", noteId)
      .order("sort_path");

    if (error) {
      console.error("Error fetching block tree:", error);
      throw new Error(`Failed to fetch block tree: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getBlockTree:", error);
    throw error;
  }
};

/**
 * Update a block
 */
export const updateBlock = async (
  blockId: string, 
  updates: UpdateBlockRequest
): Promise<void> => {
  try {
    // Get current version and increment
    const { data: currentBlock } = await supabase
      .from("blocks")
      .select("version")
      .eq("id", blockId)
      .single();

    const updateData: any = {
      updated_at: new Date().toISOString(),
      version: (currentBlock?.version || 1) + 1
    };

    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.props !== undefined) updateData.props = updates.props;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.parent_id !== undefined) updateData.parent_id = updates.parent_id;
    if (updates.audio_timestamp !== undefined) updateData.audio_timestamp = updates.audio_timestamp;

    const { error } = await supabase
      .from("blocks")
      .update(updateData)
      .eq("id", blockId);

    if (error) {
      console.error("Error updating block:", error);
      throw new Error(`Failed to update block: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in updateBlock:", error);
    throw error;
  }
};

/**
 * Delete a block and all its children
 */
export const deleteBlock = async (blockId: string): Promise<void> => {
  try {
    // The database cascade will handle child blocks
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("id", blockId);

    if (error) {
      console.error("Error deleting block:", error);
      throw new Error(`Failed to delete block: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in deleteBlock:", error);
    throw error;
  }
};

/**
 * Move a block to a new position/parent
 */
export const moveBlock = async (
  blockId: string,
  newParentId: string | null,
  newPosition: number
): Promise<void> => {
  try {
    // Update the block's parent and position
    await updateBlock(blockId, {
      parent_id: newParentId,
      position: newPosition
    });

    // Reorder siblings if necessary
    await reorderSiblings(blockId, newParentId, newPosition);
  } catch (error) {
    console.error("Error in moveBlock:", error);
    throw error;
  }
};

/**
 * Reorder siblings after a block is moved
 */
const reorderSiblings = async (
  movedBlockId: string,
  parentId: string | null,
  newPosition: number
): Promise<void> => {
  try {
    // Get all siblings
    const { data: siblings, error } = await supabase
      .from("blocks")
      .select("id, position")
      .eq("parent_id", parentId || null)
      .neq("id", movedBlockId)
      .order("position");

    if (error) throw error;

    // Calculate new positions
    const updates = [];
    let currentPosition = 1;
    
    for (const sibling of siblings || []) {
      if (currentPosition === newPosition) {
        currentPosition++; // Skip the position for moved block
      }
      
      if (sibling.position !== currentPosition) {
        updates.push({
          id: sibling.id,
          position: currentPosition
        });
      }
      currentPosition++;
    }

    // Batch update positions
    if (updates.length > 0) {
      for (const update of updates) {
        await supabase
          .from("blocks")
          .update({ position: update.position })
          .eq("id", update.id);
      }
    }
  } catch (error) {
    console.error("Error reordering siblings:", error);
    throw error;
  }
};

/**
 * Search blocks by text content
 */
export const searchBlocks = async (
  query: string,
  userId?: string,
  noteId?: string
): Promise<BlockSearchResult[]> => {
  try {
    // Use ILIKE for simple text search in JSONB props
    let queryBuilder = supabase
      .from("blocks")
      .select("*")
      .or(`props->>text.ilike.%${query}%,type.ilike.%${query}%`);

    if (userId) {
      queryBuilder = queryBuilder.eq("user_id", userId);
    }

    if (noteId) {
      queryBuilder = queryBuilder.eq("note_id", noteId);
    }

    const { data, error } = await queryBuilder
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error searching blocks:", error);
      throw new Error(`Failed to search blocks: ${error.message}`);
    }

    // Get note info for results and format
    const results: BlockSearchResult[] = [];
    
    for (const item of data || []) {
      // Get note info separately
      const { data: noteData } = await supabase
        .from("notes_new")
        .select("id, title, folder_id")
        .eq("id", item.note_id)
        .single();

      results.push({
        block: {
          id: item.id,
          user_id: item.user_id,
          note_id: item.note_id,
          parent_id: item.parent_id,
          position: item.position,
          type: item.type,
          props: item.props,
          created_at: item.created_at,
          updated_at: item.updated_at,
          audio_timestamp: item.audio_timestamp,
          ai_generated: item.ai_generated,
          version: item.version
        },
        note: noteData || { id: item.note_id, title: "Unknown", folder_id: null },
        snippet: extractSnippet(item.props?.text || "", query),
        highlight_ranges: findHighlightRanges(item.props?.text || "", query),
        relevance_score: calculateRelevance(item.props?.text || "", query)
      });
    }

    return results;
  } catch (error) {
    console.error("Error in searchBlocks:", error);
    throw error;
  }
};

/**
 * Get blocks by audio timestamp range
 */
export const getBlocksByTimeRange = async (
  noteId: string,
  startTime: number,
  endTime: number
): Promise<Block[]> => {
  try {
    const { data, error } = await supabase
      .from("blocks")
      .select("*")
      .eq("note_id", noteId)
      .gte("audio_timestamp", startTime)
      .lte("audio_timestamp", endTime)
      .order("audio_timestamp");

    if (error) {
      console.error("Error fetching blocks by time range:", error);
      throw new Error(`Failed to fetch blocks: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error("Error in getBlocksByTimeRange:", error);
    throw error;
  }
};

/**
 * Bulk create blocks (for importing or batch operations)
 */
export const createBlocksBatch = async (
  blocks: CreateBlockRequest[]
): Promise<string[]> => {
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("User not authenticated");

    const blockData = blocks.map(block => ({
      user_id: user.user.id,
      note_id: block.note_id,
      parent_id: block.parent_id || null,
      position: block.position,
      type: block.type,
      props: block.props,
      audio_timestamp: block.audio_timestamp || null,
      ai_generated: block.ai_generated || false,
    }));

    const { data, error } = await supabase
      .from("blocks")
      .insert(blockData)
      .select("id");

    if (error) {
      console.error("Error creating blocks batch:", error);
      throw new Error(`Failed to create blocks: ${error.message}`);
    }

    return (data || []).map(item => item.id);
  } catch (error) {
    console.error("Error in createBlocksBatch:", error);
    throw error;
  }
};

// Helper functions
const extractSnippet = (text: string, query: string, maxLength: number = 200): string => {
  if (!text || !query) return text?.substring(0, maxLength) || "";
  
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  const index = textLower.indexOf(queryLower);
  
  if (index === -1) return text.substring(0, maxLength);
  
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + query.length + 150);
  
  return text.substring(start, end);
};

const findHighlightRanges = (text: string, query: string): Array<{ start: number; end: number }> => {
  if (!text || !query) return [];
  
  const ranges = [];
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  let index = 0;
  
  while ((index = textLower.indexOf(queryLower, index)) !== -1) {
    ranges.push({ start: index, end: index + query.length });
    index += query.length;
  }
  
  return ranges;
};

const calculateRelevance = (text: string, query: string): number => {
  if (!text || !query) return 0;
  
  const queryWords = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();
  let score = 0;
  
  for (const word of queryWords) {
    const occurrences = (textLower.match(new RegExp(word, 'g')) || []).length;
    score += occurrences;
  }
  
  // Normalize by text length
  return score / (text.length / 100);
};