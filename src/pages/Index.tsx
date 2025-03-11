
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AudioInputCard } from '@/components/ui/AudioInputCard';
import { AudioRecorder } from '@/components/audio/AudioRecorder';
import { AudioUploader } from '@/components/audio/AudioUploader';
import { Mic, Upload, Search } from 'lucide-react';
import { NoteList } from '@/components/notes/NoteList';
import { Note } from '@/components/notes/NoteCard';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Mock data for demonstration
const mockNotes: Note[] = [
  {
    id: '1',
    title: 'Introduction to Quantum Computing',
    date: new Date(2023, 10, 15),
    preview: 'This lecture covered the fundamentals of quantum computing, including qubits, superposition, and entanglement.'
  },
  {
    id: '2',
    title: 'Advanced Machine Learning Techniques',
    date: new Date(2023, 10, 10),
    preview: 'Deep dive into neural networks, backpropagation, and gradient descent algorithms.'
  },
];

type InputMethod = 'record' | 'upload' | 'url';

const Index = () => {
  const navigate = useNavigate();
  const [inputMethod, setInputMethod] = useState<InputMethod>('record');
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleAudioSaved = (blob: Blob) => {
    // In a real app, this would upload the blob to a server for processing
    console.log('Audio blob saved:', blob);
    
    // Simulate processing
    simulateProcessing();
  };
  
  const handleAudioUploaded = (file: File) => {
    // In a real app, this would upload the file to a server for processing
    console.log('Audio file uploaded:', file);
    
    // Simulate processing
    simulateProcessing();
  };
  
  const simulateProcessing = () => {
    setIsProcessing(true);
    
    // Simulate a delay for processing
    setTimeout(() => {
      setIsProcessing(false);
      
      // Add a new note
      const newNote: Note = {
        id: Date.now().toString(),
        title: `Lecture Notes - ${new Date().toLocaleDateString()}`,
        date: new Date(),
        preview: 'This note was automatically generated from your audio recording.'
      };
      
      setNotes(prev => [newNote, ...prev]);
    }, 3000);
  };
  
  const handleNoteClick = (id: string) => {
    navigate(`/notes/${id}`);
  };
  
  const filteredNotes = searchQuery 
    ? notes.filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (note.preview && note.preview.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : notes;
  
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text">
            Lecture<span>Scribe</span>
          </h1>
          <p className="text-muted-foreground">
            Transform lectures into structured notes with AI
          </p>
        </div>
        
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">New Note</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <AudioInputCard
              icon={<Mic className="h-5 w-5" />}
              title="Record Audio"
              description="Use your microphone to record lectures"
              isActive={inputMethod === 'record'}
              onClick={() => setInputMethod('record')}
            />
            <AudioInputCard
              icon={<Upload className="h-5 w-5" />}
              title="Upload Audio"
              description="Upload MP3, WAV, or M4A files"
              isActive={inputMethod === 'upload'}
              onClick={() => setInputMethod('upload')}
            />
            <AudioInputCard
              icon={<Search className="h-5 w-5" />}
              title="Web Link"
              description="Link to YouTube or other sources"
              isActive={inputMethod === 'url'}
              onClick={() => setInputMethod('url')}
            />
          </div>
          
          {inputMethod === 'record' && (
            <AudioRecorder onAudioSaved={handleAudioSaved} />
          )}
          
          {inputMethod === 'upload' && (
            <AudioUploader onAudioUploaded={handleAudioUploaded} />
          )}
          
          {inputMethod === 'url' && (
            <div className="w-full max-w-lg mx-auto">
              <div className="flex gap-2 items-center">
                <Input
                  placeholder="Paste a YouTube URL, Google Drive link, etc."
                  className="flex-1"
                />
                <Button>Process</Button>
              </div>
            </div>
          )}
          
          {isProcessing && (
            <div className="mt-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center">
                <div className="h-3 w-3 rounded-full bg-brand animate-pulse mr-3"></div>
                <p className="text-sm">Processing your audio... This may take a few minutes.</p>
              </div>
            </div>
          )}
        </div>
        
        <Separator className="my-8" />
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold">My Notes</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 max-w-xs"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <Tabs defaultValue="all" className="mb-6">
            <TabsList>
              <TabsTrigger value="all">All Notes</TabsTrigger>
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="favorites">Favorites</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <NoteList notes={filteredNotes} onNoteClick={handleNoteClick} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
