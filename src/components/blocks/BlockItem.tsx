import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Block, BlockType, TextBlockProps, HeadingBlockProps, TranscriptionBlockProps } from "@/types/blocks";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  GripVertical,
  Trash2,
  Plus,
  Edit,
  Check,
  X,
  Type,
  Heading1,
  Heading2,
  Heading3,
  FileText,
  Mic,
  ListChecks,
  Lightbulb,
  Quote,
  Code,
  Table,
  Minus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface BlockItemProps {
  block: Block;
  onUpdate: (blockId: string, updates: any) => void;
  onDelete: (blockId: string) => void;
  onInsertAfter: () => void;
  readOnly?: boolean;
  onTimestampClick?: (timestamp: number) => void;
}

const getBlockIcon = (type: BlockType) => {
  switch (type) {
    case "text":
      return <Type className="w-4 h-4" />;
    case "heading-1":
      return <Heading1 className="w-4 h-4" />;
    case "heading-2":
      return <Heading2 className="w-4 h-4" />;
    case "heading-3":
      return <Heading3 className="w-4 h-4" />;
    case "transcription":
      return <Mic className="w-4 h-4" />;
    case "summary":
      return <FileText className="w-4 h-4" />;
    case "key-point":
      return <Lightbulb className="w-4 h-4" />;
    case "action-item":
      return <ListChecks className="w-4 h-4" />;
    case "quote":
      return <Quote className="w-4 h-4" />;
    case "code":
      return <Code className="w-4 h-4" />;
    case "table":
      return <Table className="w-4 h-4" />;
    case "divider":
      return <Minus className="w-4 h-4" />;
    default:
      return <FileText className="w-4 h-4" />;
  }
};

export const BlockItem: React.FC<BlockItemProps> = ({
  block,
  onUpdate,
  onDelete,
  onInsertAfter,
  readOnly = false,
  onTimestampClick,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleEdit = () => {
    const text = getBlockText(block);
    setEditValue(text);
    setIsEditing(true);
  };

  const handleSave = () => {
    const updates: any = { props: { ...block.props } };
    
    if (block.type === "heading-1" || block.type === "heading-2" || block.type === "heading-3") {
      updates.props.text = editValue;
    } else if ("text" in block.props) {
      updates.props.text = editValue;
    }

    onUpdate(block.id, updates);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const getBlockText = (block: Block): string => {
    const props = block.props as any;
    return props.text || props.content || "";
  };

  const renderBlockContent = () => {
    if (isEditing) {
      const isHeading = block.type.startsWith("heading");
      const Component = isHeading ? Input : Textarea;
      
      return (
        <div className="flex-1 flex gap-2">
          <Component
            ref={inputRef as any}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                handleSave();
              } else if (e.key === "Escape") {
                handleCancel();
              }
            }}
            className={cn(
              "flex-1",
              isHeading && "font-semibold",
              block.type === "heading-1" && "text-2xl",
              block.type === "heading-2" && "text-xl",
              block.type === "heading-3" && "text-lg"
            )}
            rows={isHeading ? 1 : 3}
          />
          <Button size="icon" variant="ghost" onClick={handleSave}>
            <Check className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    const text = getBlockText(block);
    
    switch (block.type) {
      case "heading-1":
        return <h1 className="text-2xl font-bold">{text}</h1>;
      case "heading-2":
        return <h2 className="text-xl font-semibold">{text}</h2>;
      case "heading-3":
        return <h3 className="text-lg font-medium">{text}</h3>;
      case "transcription":
        const transcriptionProps = block.props as TranscriptionBlockProps;
        return (
          <div className="space-y-1">
            <p className="text-sm">{text}</p>
            {transcriptionProps.speaker && (
              <p className="text-xs text-muted-foreground">Speaker: {transcriptionProps.speaker}</p>
            )}
            {transcriptionProps.audio_start !== undefined && (
              <button
                onClick={() => onTimestampClick?.(transcriptionProps.audio_start!)}
                className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline cursor-pointer"
              >
                {formatTime(transcriptionProps.audio_start)} - {formatTime(transcriptionProps.audio_end || 0)}
              </button>
            )}
          </div>
        );
      case "key-point":
        return (
          <div className="flex gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
            <p className="font-medium">{text}</p>
          </div>
        );
      case "action-item":
        return (
          <div className="flex gap-2">
            <ListChecks className="w-5 h-5 text-blue-500 mt-0.5" />
            <p>{text}</p>
          </div>
        );
      case "quote":
        return (
          <blockquote className="border-l-4 border-muted-foreground/30 pl-4 italic">
            "{text}"
          </blockquote>
        );
      case "divider":
        return <hr className="my-4" />;
      default:
        return <p className="text-sm">{text}</p>;
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex items-start gap-2 p-3 rounded-lg border bg-card transition-all",
        isDragging && "opacity-50",
        block.ai_generated && "border-blue-200 dark:border-blue-900",
        "hover:shadow-sm"
      )}
    >
      {!readOnly && (
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        {renderBlockContent()}
      </div>

      {!readOnly && !isEditing && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleEdit}
            className="h-8 w-8"
          >
            <Edit className="w-4 h-4" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <Plus className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={onInsertAfter}>
                Insert block after
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onDelete(block.id)}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {block.ai_generated && (
        <div className="absolute top-1 right-1 text-xs text-muted-foreground bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">
          AI
        </div>
      )}
    </div>
  );
};