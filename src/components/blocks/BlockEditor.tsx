import React, { useState, useEffect, useCallback } from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Block, BlockType, CreateBlockRequest } from "@/types/blocks";
import { getBlocksForNote, createBlock, updateBlock, deleteBlock, moveBlock } from "@/services/blockService";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BlockItem } from "./BlockItem";
import { BlockTypeMenu } from "./BlockTypeMenu";

interface BlockEditorProps {
  noteId: string;
  onBlocksChange?: (blocks: Block[]) => void;
  readOnly?: boolean;
  onTimestampClick?: (timestamp: number) => void;
}

export const BlockEditor: React.FC<BlockEditorProps> = ({
  noteId,
  onBlocksChange,
  readOnly = false,
  onTimestampClick,
}) => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  // Load blocks on mount
  useEffect(() => {
    loadBlocks();
  }, [noteId]);

  const loadBlocks = async () => {
    try {
      setIsLoading(true);
      const loadedBlocks = await getBlocksForNote(noteId);
      setBlocks(loadedBlocks);
      onBlocksChange?.(loadedBlocks);
    } catch (error) {
      console.error("Error loading blocks:", error);
      toast.error("Failed to load content");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBlock = async (type: BlockType, position?: number) => {
    if (readOnly) return;

    try {
      setIsAdding(true);
      
      // Default props based on type
      const defaultProps: any = {
        text: "",
      };

      if (type === "heading-1" || type === "heading-2" || type === "heading-3") {
        defaultProps.level = parseInt(type.split("-")[1]);
      }

      const request: CreateBlockRequest = {
        note_id: noteId,
        type,
        props: defaultProps,
        position: position ?? blocks.length + 1,
      };

      const newBlockId = await createBlock(request);
      
      // Reload blocks to get the new one
      await loadBlocks();
      
      toast.success("Block added");
      setShowTypeMenu(false);
      setInsertPosition(null);
    } catch (error) {
      console.error("Error creating block:", error);
      toast.error("Failed to add block");
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateBlock = async (blockId: string, updates: any) => {
    if (readOnly) return;

    try {
      await updateBlock(blockId, updates);
      
      // Update local state optimistically
      setBlocks(prev => 
        prev.map(block => 
          block.id === blockId 
            ? { ...block, ...updates, props: { ...block.props, ...updates.props } }
            : block
        )
      );
    } catch (error) {
      console.error("Error updating block:", error);
      toast.error("Failed to update block");
      // Reload to get correct state
      loadBlocks();
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (readOnly) return;

    try {
      await deleteBlock(blockId);
      
      // Update local state optimistically
      setBlocks(prev => prev.filter(block => block.id !== blockId));
      
      toast.success("Block deleted");
    } catch (error) {
      console.error("Error deleting block:", error);
      toast.error("Failed to delete block");
      // Reload to get correct state
      loadBlocks();
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (readOnly) return;

    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex(b => b.id === active.id);
    const newIndex = blocks.findIndex(b => b.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder blocks locally for immediate feedback
    const newBlocks = [...blocks];
    const [movedBlock] = newBlocks.splice(oldIndex, 1);
    newBlocks.splice(newIndex, 0, movedBlock);
    setBlocks(newBlocks);

    // Update positions
    try {
      await moveBlock(active.id as string, null, newIndex + 1);
      toast.success("Block moved");
    } catch (error) {
      console.error("Error moving block:", error);
      toast.error("Failed to move block");
      // Reload to get correct state
      loadBlocks();
    }
  };

  const handleInsertBlock = (position: number) => {
    setInsertPosition(position);
    setShowTypeMenu(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const sortedBlocks = blocks
    .filter(block => !block.parent_id)
    .sort((a, b) => a.position - b.position);

  return (
    <div className="block-editor space-y-2">
      {!readOnly && blocks.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            No content yet. Start by adding a block.
          </p>
          <Button
            onClick={() => setShowTypeMenu(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add First Block
          </Button>
        </div>
      )}

      {sortedBlocks.length > 0 && (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={sortedBlocks.map(b => b.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedBlocks.map((block, index) => (
                <div key={block.id}>
                  <BlockItem
                    block={block}
                    onUpdate={handleUpdateBlock}
                    onDelete={handleDeleteBlock}
                    onInsertAfter={() => handleInsertBlock(block.position + 1)}
                    readOnly={readOnly}
                    onTimestampClick={onTimestampClick}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {!readOnly && blocks.length > 0 && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTypeMenu(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Block
          </Button>
        </div>
      )}

      {showTypeMenu && (
        <BlockTypeMenu
          onSelect={(type) => handleCreateBlock(type, insertPosition || undefined)}
          onClose={() => {
            setShowTypeMenu(false);
            setInsertPosition(null);
          }}
        />
      )}
    </div>
  );
};