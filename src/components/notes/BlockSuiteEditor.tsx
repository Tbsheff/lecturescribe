
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
      schema: {}, // Add empty schema object to satisfy the API
    });
    setDocCollection(collection);

    // Register the required blocks
    import('@blocksuite/blocks').then((blocks) => {
      // Register the default blocks using the updated API
      blocks.BlockSchema.register(collection);
      
      // Create a page for this note
      const page = collection.createDoc({ id: `page:${noteId}` });
      setPageId(page.id);
      
      if (page) {
        // Initialize with default content if it's a new page
        if (!initialContent) {
          // Create a default page structure with current BlockSuite API
          page.addBlock('affine:page', {});
          page.addBlock('affine:surface', {});
          page.addBlock('affine:note', {});
          page.addBlock('affine:paragraph', {});
        } else {
          // Create a default structure and add a paragraph with the initial content
          page.addBlock('affine:page', {});
          page.addBlock('affine:surface', {});
          page.addBlock('affine:note', {});
          page.addBlock('affine:paragraph', { text: initialContent });
          
          // In the future, implement markdown to blocksuite conversion
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
            const content = JSON.stringify(collection.export());
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
