
import React, { useEffect, useRef, useState } from "react";
import { EditorContainer } from "@blocksuite/editor";
import { DocCollection } from "@blocksuite/store";
import * as Y from "yjs";

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
  const [editor, setEditor] = useState<EditorContainer | null>(null);
  const [docCollection, setDocCollection] = useState<DocCollection | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);

  // Setup the editor
  useEffect(() => {
    if (!editorRef.current) return;
    
    // Create a new doc collection with the appropriate ID
    const collection = new DocCollection({
      id: `note-${noteId}`,
    });
    setDocCollection(collection);

    // Register the required blocks
    import('@blocksuite/blocks').then((blocks) => {
      // Register all available block schemas
      blocks.DefaultBlockSchema.register(collection);
      
      // Create a page for this note
      const page = collection.createDoc({ id: `page:${noteId}` });
      setPageId(page.id);
      
      if (page) {
        // Initialize with default content if it's a new page
        if (!initialContent) {
          // Create a default page structure using the current BlockSuite API
          const pageId = page.addBlock('affine:page');
          page.addBlock('affine:surface', {}, pageId);
          const noteId = page.addBlock('affine:note', {}, pageId);
          page.addBlock('affine:paragraph', {}, noteId);
        } else {
          // Create a default structure and add a paragraph with the initial content
          const pageId = page.addBlock('affine:page');
          page.addBlock('affine:surface', {}, pageId);
          const noteId = page.addBlock('affine:note', {}, pageId);
          page.addBlock('affine:paragraph', {
            text: [
              { insert: initialContent }
            ]
          }, noteId);
          
          console.log("Need to convert markdown to BlockSuite content:", initialContent);
        }

        // Create and mount the editor
        const editorContainer = new EditorContainer();
        editorContainer.page = page;
        editorRef.current.innerHTML = '';
        editorRef.current.appendChild(editorContainer);
        setEditor(editorContainer);

        // Set up auto-saving
        const autoSave = setInterval(() => {
          if (onSave && page) {
            // Use the appropriate serialization method for the current API
            const content = JSON.stringify(page.toJSON());
            onSave(content);
          }
        }, 3000);

        return () => {
          clearInterval(autoSave);
          if (editorContainer) {
            editorContainer.remove();
          }
        };
      }
    });
    
    return () => {
      if (collection) {
        // Clean up collection
      }
    };
  }, [noteId, initialContent]);

  return (
    <div className="blocksuite-editor-container" style={{ height: "100%", width: "100%" }}>
      <div ref={editorRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
};

export default BlockSuiteEditor;
