import { supabase } from "@/integrations/supabase/client";
import { CreateBlockRequest, BlockType } from "@/types/blocks";
import { createBlocksBatch } from "./blockService";

/**
 * Check if a note has been migrated to blocks
 */
export const isNoteMigrated = async (noteId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("blocks")
      .select("id")
      .eq("note_id", noteId)
      .limit(1);

    if (error) throw error;
    
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error("Error checking note migration status:", error);
    return false;
  }
};

/**
 * Migrate a traditional note to block format
 */
export const migrateNoteToBlocks = async (noteId: string, noteData: any): Promise<void> => {
  try {
    // Check if already migrated
    const migrated = await isNoteMigrated(noteId);
    if (migrated) {
      console.log("Note already migrated to blocks");
      return;
    }

    const blocks: CreateBlockRequest[] = [];
    let position = 1;

    // Add title as heading-1
    if (noteData.title) {
      blocks.push({
        note_id: noteId,
        type: "heading-1",
        props: {
          text: noteData.title,
          level: 1,
        },
        position: position++,
      });
    }

    // Add summary section
    if (noteData.structured_summary?.summary || noteData.raw_summary) {
      blocks.push({
        note_id: noteId,
        type: "heading-2",
        props: {
          text: "Summary",
          level: 2,
        },
        position: position++,
      });

      blocks.push({
        note_id: noteId,
        type: "summary",
        props: {
          text: noteData.structured_summary?.summary || noteData.raw_summary,
          summary_type: "ai-generated",
          model_used: "gemini",
        },
        position: position++,
        ai_generated: true,
      });
    }

    // Add key points
    if (noteData.structured_summary?.keyPoints?.length > 0) {
      blocks.push({
        note_id: noteId,
        type: "heading-2",
        props: {
          text: "Key Points",
          level: 2,
        },
        position: position++,
      });

      for (const point of noteData.structured_summary.keyPoints) {
        blocks.push({
          note_id: noteId,
          type: "key-point",
          props: {
            text: point,
            importance: "medium",
          },
          position: position++,
          ai_generated: true,
        });
      }
    }

    // Add sections if available
    if (noteData.structured_summary?.sections?.length > 0) {
      for (const section of noteData.structured_summary.sections) {
        blocks.push({
          note_id: noteId,
          type: "heading-2",
          props: {
            text: section.title,
            level: 2,
          },
          position: position++,
          ai_generated: true,
        });

        if (section.content) {
          blocks.push({
            note_id: noteId,
            type: "text",
            props: {
              text: section.content,
            },
            position: position++,
            ai_generated: true,
          });
        }

        // Add subsections
        if (section.subsections?.length > 0) {
          for (const subsection of section.subsections) {
            blocks.push({
              note_id: noteId,
              type: "heading-3",
              props: {
                text: subsection.title,
                level: 3,
              },
              position: position++,
              ai_generated: true,
            });

            if (subsection.content) {
              blocks.push({
                note_id: noteId,
                type: "text",
                props: {
                  text: subsection.content,
                },
                position: position++,
                ai_generated: true,
              });
            }
          }
        }
      }
    }

    // Add transcription
    if (noteData.transcription) {
      blocks.push({
        note_id: noteId,
        type: "divider",
        props: {
          style: "line",
        },
        position: position++,
      });

      blocks.push({
        note_id: noteId,
        type: "heading-2",
        props: {
          text: "Full Transcript",
          level: 2,
        },
        position: position++,
      });

      // Split transcription into paragraphs and add timestamps
      const paragraphs = noteData.transcription.split(/\n\n+/);
      const totalDuration = noteData.duration || 0;
      const paragraphCount = paragraphs.filter(p => p.trim()).length;
      const avgDurationPerParagraph = totalDuration > 0 ? totalDuration / paragraphCount : 0;
      
      let currentTime = 0;
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          blocks.push({
            note_id: noteId,
            type: "transcription",
            props: {
              text: paragraph.trim(),
              confidence: 0.9,
              audio_start: currentTime,
              audio_end: currentTime + avgDurationPerParagraph,
            },
            position: position++,
            ai_generated: true,
            audio_timestamp: currentTime,
          });
          currentTime += avgDurationPerParagraph;
        }
      }
    }

    // Add user notes if they exist
    if (noteData.user_notes) {
      blocks.push({
        note_id: noteId,
        type: "divider",
        props: {
          style: "line",
        },
        position: position++,
      });

      blocks.push({
        note_id: noteId,
        type: "heading-2",
        props: {
          text: "Notes",
          level: 2,
        },
        position: position++,
      });

      blocks.push({
        note_id: noteId,
        type: "text",
        props: {
          text: noteData.user_notes,
        },
        position: position++,
        ai_generated: false,
      });
    }

    // Create all blocks in batch
    if (blocks.length > 0) {
      await createBlocksBatch(blocks);
      console.log(`Migrated ${blocks.length} blocks for note ${noteId}`);
    }
  } catch (error) {
    console.error("Error migrating note to blocks:", error);
    throw error;
  }
};

/**
 * Extract action items from note content and create action-item blocks
 */
export const extractActionItems = async (noteId: string): Promise<void> => {
  try {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("*")
      .eq("note_id", noteId)
      .in("type", ["text", "transcription", "summary"]);

    if (!blocks || blocks.length === 0) return;

    const actionItems: CreateBlockRequest[] = [];
    let position = blocks.length + 1;

    // Look for action items patterns
    const actionPatterns = [
      /(?:todo|task|action item|assignment|homework|due):\s*(.+)/gi,
      /(?:need to|should|must|have to|required to)\s+(.+?)(?:\.|$)/gi,
      /(?:deadline|due date|submit by):\s*(.+)/gi,
    ];

    for (const block of blocks) {
      const text = (block.props as any).text || "";
      
      for (const pattern of actionPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          actionItems.push({
            note_id: noteId,
            type: "action-item",
            props: {
              text: match[1].trim(),
              completed: false,
              priority: "medium",
            },
            position: position++,
            ai_generated: true,
          });
        }
      }
    }

    if (actionItems.length > 0) {
      // Add a section for action items
      const sectionBlock: CreateBlockRequest = {
        note_id: noteId,
        type: "heading-2",
        props: {
          text: "Action Items",
          level: 2,
        },
        position: position++,
      };

      await createBlocksBatch([sectionBlock, ...actionItems]);
      console.log(`Extracted ${actionItems.length} action items`);
    }
  } catch (error) {
    console.error("Error extracting action items:", error);
  }
};