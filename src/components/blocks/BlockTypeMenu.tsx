import React from "react";
import { BlockType } from "@/types/blocks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
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
  AudioLines,
  Image,
  MessageSquare,
} from "lucide-react";

interface BlockTypeMenuProps {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

interface BlockTypeOption {
  type: BlockType;
  label: string;
  description: string;
  icon: React.ReactNode;
  category: "text" | "media" | "structure";
}

const blockTypes: BlockTypeOption[] = [
  {
    type: "text",
    label: "Text",
    description: "Plain paragraph text",
    icon: <Type className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "heading-1",
    label: "Heading 1",
    description: "Main section heading",
    icon: <Heading1 className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "heading-2",
    label: "Heading 2",
    description: "Subsection heading",
    icon: <Heading2 className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "heading-3",
    label: "Heading 3",
    description: "Sub-subsection heading",
    icon: <Heading3 className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "transcription",
    label: "Transcription",
    description: "AI-generated transcript segment",
    icon: <Mic className="w-5 h-5" />,
    category: "media",
  },
  {
    type: "summary",
    label: "Summary",
    description: "AI or manual summary",
    icon: <FileText className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "key-point",
    label: "Key Point",
    description: "Important highlight",
    icon: <Lightbulb className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "action-item",
    label: "Action Item",
    description: "Task or to-do item",
    icon: <ListChecks className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "quote",
    label: "Quote",
    description: "Important quote from lecture",
    icon: <Quote className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "code",
    label: "Code",
    description: "Code snippet with syntax highlighting",
    icon: <Code className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "audio-clip",
    label: "Audio Clip",
    description: "Embedded audio segment",
    icon: <AudioLines className="w-5 h-5" />,
    category: "media",
  },
  {
    type: "slide-image",
    label: "Image/Slide",
    description: "Lecture slide or image",
    icon: <Image className="w-5 h-5" />,
    category: "media",
  },
  {
    type: "annotation",
    label: "Annotation",
    description: "Comment or note",
    icon: <MessageSquare className="w-5 h-5" />,
    category: "text",
  },
  {
    type: "table",
    label: "Table",
    description: "Data table",
    icon: <Table className="w-5 h-5" />,
    category: "structure",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visual separator",
    icon: <Minus className="w-5 h-5" />,
    category: "structure",
  },
];

export const BlockTypeMenu: React.FC<BlockTypeMenuProps> = ({
  onSelect,
  onClose,
}) => {
  const categories = ["text", "media", "structure"];
  const categoryLabels = {
    text: "Text & Content",
    media: "Media & Audio",
    structure: "Structure",
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a Block</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {categoryLabels[category as keyof typeof categoryLabels]}
              </h3>
              
              <div className="grid grid-cols-2 gap-2">
                {blockTypes
                  .filter((bt) => bt.category === category)
                  .map((blockType) => (
                    <Button
                      key={blockType.type}
                      variant="outline"
                      className="h-auto p-4 justify-start"
                      onClick={() => {
                        onSelect(blockType.type);
                        onClose();
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{blockType.icon}</div>
                        <div className="text-left">
                          <div className="font-medium">{blockType.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {blockType.description}
                          </div>
                        </div>
                      </div>
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};