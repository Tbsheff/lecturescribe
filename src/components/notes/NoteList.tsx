import React from 'react';
import { NoteCard, Note } from './NoteCard';

interface NoteListProps {
  notes: Note[];
  onNoteClick: (id: string) => void;
}

export const NoteList: React.FC<NoteListProps> = ({ notes, onNoteClick }) => {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No notes yet. Start by recording or uploading audio.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onClick={onNoteClick} />
      ))}
    </div>
  );
};
