
import React, { useEffect, useRef } from "react";
import { PageEditor, createEmptyDoc } from "@blocksuite/presets";
import * as Y from "yjs";

// Import CSS for BlockSuite editor - using direct CSS import that's available in the package
import "@blocksuite/presets/dist/style.css";

interface BlockSuiteEditorProps {
  noteId: string;
  userId: string;
  initialContent?: string;
  onSave?: (content: string) => void;
}

const BlockSuiteEditor: React.FC<BlockSuiteEditorProps> = ({
  noteId,
  userId,
  initialContent,
  onSave,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<PageEditor | null>(null);

  // Setup the editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Create a new document
    const doc = createEmptyDoc();
    
    // Initialize the document
    doc.init().then(() => {
      if (initialContent) {
        try {
          // Try to parse initialContent as JSON if it's structured BlockSuite content
          const parsedContent = JSON.parse(initialContent);
          if (parsedContent && typeof parsedContent === 'object') {
            console.log("Found structured content");
            // If we have valid JSON, we could try to import it
            // This is placeholder - actual import would depend on BlockSuite version
          }
        } catch (e) {
          console.log("No valid JSON content, using as plain text");
          // Get the first paragraph block and update its text content
          const paragraphs = doc.getBlockByFlavour('affine:paragraph');
          if (paragraphs && paragraphs.length > 0) {
            const paragraph = paragraphs[0];
            doc.updateBlock(paragraph, { text: new Y.Text(initialContent || 'Start writing here...') });
          } else {
            // If no paragraph blocks exist, create the structure
            const pageBlockId = doc.addBlock('affine:page');
            doc.addBlock('affine:surface', {}, pageBlockId);
            const noteBlockId = doc.addBlock('affine:note', {}, pageBlockId);
            doc.addBlock('affine:paragraph', {
              text: new Y.Text(initialContent || 'Start writing here...')
            }, noteBlockId);
          }
        }
      }
    });

    // Create and mount the editor
    const editor = new PageEditor();
    editor.doc = doc;
    
    editorRef.current.innerHTML = '';
    editorRef.current.appendChild(editor);
    editorInstanceRef.current = editor;

    // Set up auto-saving
    if (onSave) {
      const autoSave = setInterval(() => {
        try {
          // Use Y.Doc as a simple serialization format
          const serialized = JSON.stringify({
            content: Array.from(Y.encodeStateAsUpdate(doc.spaceDoc))
          });
          onSave(serialized);
        } catch (error) {
          console.error("Error during auto-save:", error);
        }
      }, 3000);

      return () => {
        clearInterval(autoSave);
      };
    }

    return () => {
      if (editor) {
        editor.remove();
      }
    };
  }, [noteId, userId, initialContent, onSave]);

  return (
    <div className="blocksuite-editor-container" style={{ height: "100%", width: "100%" }}>
      <div ref={editorRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

export default BlockSuiteEditor;
