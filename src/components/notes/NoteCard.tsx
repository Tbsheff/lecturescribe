
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Note {
  id: string;
  title: string;
  date: Date;
  preview?: string;
}

interface NoteCardProps {
  note: Note;
  onClick: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onClick }) => {
  return (
    <Card 
      className="cursor-pointer border border-border/50 hover:border-brand/30 transition-all duration-300 card-hover"
      onClick={() => onClick(note.id)}
    >
      <CardContent className="p-4 flex items-center">
        <div className="bg-secondary rounded-md p-2 mr-3">
          <FileText className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate">{note.title}</h3>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(note.date, { addSuffix: true })}
          </p>
          {note.preview && (
            <p className="text-sm text-muted-foreground mt-1 truncate">
              {note.preview}
            </p>
          )}
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
};
