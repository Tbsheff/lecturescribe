import React, { useState, useEffect, useRef, KeyboardEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Image,
  Link,
  Underline,
  Quote,
  CheckSquare,
  AlertTriangle,
  Info,
  Strikethrough,
  Upload,
} from "lucide-react";
import { updateNoteContent } from "@/services/noteStorage";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

interface NoteEditorProps {
  noteId: string;
  userId: string;
  initialContent: string;
  onSave?: (content: string) => void;
}

interface CalloutType {
  icon: React.ReactNode;
  label: string;
  bgColor: string;
  borderColor: string;
}

const NoteEditor: React.FC<NoteEditorProps> = ({
  noteId,
  userId,
  initialContent,
  onSave,
}) => {
  const [content, setContent] = useState(initialContent || "");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedContent, setLastSavedContent] = useState(
    initialContent || "",
  );
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [isImageDialogOpen, setIsImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("Image");
  const [imageWidth, setImageWidth] = useState("auto");
  const [imageAlign, setImageAlign] = useState("center");

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calloutTypes: Record<string, CalloutType> = {
    note: {
      icon: <Info className="h-4 w-4" />,
      label: "Note",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      borderColor: "border-blue-200 dark:border-blue-800",
    },
    warning: {
      icon: <AlertTriangle className="h-4 w-4" />,
      label: "Warning",
      bgColor: "bg-amber-50 dark:bg-amber-950",
      borderColor: "border-amber-200 dark:border-amber-800",
    },
    info: {
      icon: <Info className="h-4 w-4" />,
      label: "Info",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      borderColor: "border-indigo-200 dark:border-indigo-800",
    },
  };

  // Auto-save when content changes after a delay
  useEffect(() => {
    if (content !== lastSavedContent) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveContent();
      }, 1500); // 1.5 second delay before saving
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content]);

  // Save content to the server
  const saveContent = async () => {
    if (content === lastSavedContent) return;

    try {
      setIsSaving(true);
      await updateNoteContent(userId, noteId, content);
      setLastSavedContent(content);
      if (onSave) onSave(content);
    } catch (error: any) {
      console.error("Error saving note content:", error);
      toast.error(`Failed to save note: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Insert formatting at cursor position
  const insertFormatting = (prefix: string, suffix: string = "") => {
    if (!editorRef.current) return;

    const textarea = editorRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const beforeText = content.substring(0, start);
    const afterText = content.substring(end);

    const newContent = beforeText + prefix + selectedText + suffix + afterText;
    setContent(newContent);

    // Focus back on textarea and set cursor position after formatting
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        end + prefix.length + (selectedText.length > 0 ? 0 : suffix.length),
      );
    }, 0);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case "b":
          e.preventDefault();
          handleBold();
          break;
        case "i":
          e.preventDefault();
          handleItalic();
          break;
        case "u":
          e.preventDefault();
          handleUnderline();
          break;
        case "1":
          e.preventDefault();
          handleHeading1();
          break;
        case "2":
          e.preventDefault();
          handleHeading2();
          break;
        case "3":
          e.preventDefault();
          handleHeading3();
          break;
        case "k":
          e.preventDefault();
          handleLink();
          break;
      }
    } else if (e.key === "Tab") {
      // Handle tab for indentation in lists
      const textarea = editorRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentLine = getCurrentLine(content, start);

      // Check if we're in a list item
      if (/^(\s*)([-*+]|\d+\.)\s/.test(currentLine)) {
        e.preventDefault();

        if (e.shiftKey) {
          // Unindent: remove 2 spaces if present
          if (currentLine.startsWith("  ")) {
            const newContent =
              content.substring(0, start - currentLine.length) +
              currentLine.substring(2) +
              content.substring(end);
            setContent(newContent);
            textarea.setSelectionRange(start - 2, end - 2);
          }
        } else {
          // Indent: add 2 spaces
          const lineStart = start - getCurrentLineOffset(content, start);
          const newContent =
            content.substring(0, lineStart) +
            "  " +
            content.substring(lineStart);
          setContent(newContent);
          textarea.setSelectionRange(start + 2, end + 2);
        }
      }
    }
  };

  // Get the current line of text based on cursor position
  const getCurrentLine = (text: string, cursorPos: number): string => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastNewlineIndex = textBeforeCursor.lastIndexOf("\n");
    return textBeforeCursor.substring(lastNewlineIndex + 1);
  };

  // Get the offset of the current line from the cursor position
  const getCurrentLineOffset = (text: string, cursorPos: number): number => {
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastNewlineIndex = textBeforeCursor.lastIndexOf("\n");
    return cursorPos - (lastNewlineIndex + 1);
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For demo purposes, we'll use a placeholder URL
    // In a real app, you would upload the file to a server
    const placeholderUrl = URL.createObjectURL(file);
    insertFormatting(`![${file.name}](${placeholderUrl})`);

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Insert image with custom attributes
  const insertImage = () => {
    if (!imageUrl) {
      toast.error("Please enter an image URL");
      return;
    }

    const imgMarkdown = `![${imageAlt}](${imageUrl})`;
    insertFormatting(imgMarkdown);
    setIsImageDialogOpen(false);
    setImageUrl("");
    setImageAlt("Image");
  };

  // Formatting handlers
  const handleBold = () => insertFormatting("**", "**");
  const handleItalic = () => insertFormatting("*", "*");
  const handleUnderline = () => insertFormatting("<u>", "</u>");
  const handleStrikethrough = () => insertFormatting("~~", "~~");
  const handleHeading1 = () => insertFormatting("# ");
  const handleHeading2 = () => insertFormatting("## ");
  const handleHeading3 = () => insertFormatting("### ");
  const handleBulletList = () => insertFormatting("- ");
  const handleNumberedList = () => insertFormatting("1. ");
  const handleCheckbox = () => insertFormatting("- [ ] ");
  const handleCode = () => insertFormatting("```\n", "\n```");
  const handleInlineCode = () => insertFormatting("`", "`");
  const handleLink = () => insertFormatting("[", "](url)");
  const handleImage = () => {
    // For simple implementation, just insert image markdown
    insertFormatting("![alt text](", ")");
  };
  const handleQuote = () => insertFormatting("> ");

  // Insert callout block
  const handleCallout = (type: string) => {
    const callout = calloutTypes[type];
    if (!callout) return;

    const calloutText = `:::${type}\n**${callout.label}:** Write your ${type} text here\n:::\n`;
    insertFormatting(calloutText);
  };

  // Custom renderer for callouts in preview
  const customCalloutRenderer = (text: string): string => {
    // Replace callout syntax with HTML
    let processedText = text;

    // Match callout blocks
    const calloutRegex = /:::(note|warning|info)\n([\s\S]*?)\n:::/g;
    processedText = processedText.replace(
      calloutRegex,
      (match, type, content) => {
        const callout = calloutTypes[type];
        if (!callout) return match;

        return `<div class="p-4 my-4 rounded-md border ${callout.bgColor} ${callout.borderColor}">
        <div class="flex items-start">
          <div class="mr-2 text-${type}-600">${type === "note" ? "📝" : type === "warning" ? "⚠️" : "ℹ️"}</div>
          <div>${content}</div>
        </div>
      </div>`;
      },
    );

    return processedText;
  };

  return (
    <div className="flex flex-col w-full h-full">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "edit" | "preview")}
        className="w-full"
      >
        <div className="flex items-center justify-between p-2 border-b">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground">
            {isSaving ? "Saving..." : "Saved"}
          </div>
        </div>

        <TabsContent
          value="edit"
          className="flex flex-col flex-1 mt-0 border-none p-0"
        >
          <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBold}
              title="Bold (Ctrl+B)"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleItalic}
              title="Italic (Ctrl+I)"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnderline}
              title="Underline (Ctrl+U)"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStrikethrough}
              title="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHeading1}
              title="Heading 1 (Ctrl+1)"
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHeading2}
              title="Heading 2 (Ctrl+2)"
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleHeading3}
              title="Heading 3 (Ctrl+3)"
            >
              <Heading3 className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBulletList}
              title="Bullet List"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNumberedList}
              title="Numbered List"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCheckbox}
              title="Checkbox"
            >
              <CheckSquare className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleQuote}
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCallout("note")}
              title="Note Callout"
            >
              <Info className="h-4 w-4 text-blue-500" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCallout("warning")}
              title="Warning Callout"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </Button>
            <div className="h-4 w-px bg-border mx-1"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleInlineCode}
              title="Inline Code"
            >
              <span className="font-mono text-xs">`code`</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCode}
              title="Code Block"
            >
              <Code className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLink}
              title="Link (Ctrl+K)"
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleImage}
              title="Image"
            >
              <Image className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Upload Image"
            >
              <Upload className="h-4 w-4" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileUpload}
            />
          </div>

          <Textarea
            ref={editorRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[500px] p-4 text-base font-mono resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            placeholder="Start writing..."
            onBlur={saveContent}
          />
        </TabsContent>

        <TabsContent value="preview" className="mt-0 border-none p-0">
          <ScrollArea className="h-[600px] w-full rounded-md border">
            <div className="p-4">
              {content ? (
                <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-a:text-brand hover:prose-a:text-brand-dark prose-img:rounded-md prose-img:mx-auto prose-code:bg-muted prose-code:p-1 prose-code:rounded prose-code:text-sm">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  >
                    {customCalloutRenderer(content)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="text-muted-foreground text-center py-8">
                  Nothing to preview yet. Start writing in the editor.
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NoteEditor;
