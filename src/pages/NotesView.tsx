import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Copy, FileText } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const NotesView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const dummyNote = {
    id: id || '1',
    title: 'Introduction to Quantum Computing',
    date: new Date(),
    content: {
      summary: 'This lecture provided a comprehensive introduction to quantum computing, covering the fundamental principles, key algorithms, and potential applications.',
      keyPoints: [
        'Quantum bits (qubits) can exist in superposition states',
        'Quantum entanglement allows for instantaneous correlation between qubits',
        'Quantum algorithms can solve certain problems exponentially faster than classical algorithms',
        'Shor\'s algorithm threatens modern cryptography by efficiently factoring large numbers',
        'Quantum error correction is essential to build practical quantum computers'
      ],
      sections: [
        {
          title: 'Fundamentals of Quantum Mechanics',
          content: 'The lecture began with an overview of quantum mechanical principles that enable quantum computing. These include superposition, entanglement, and quantum measurement...',
          subsections: [
            {
              title: 'Superposition',
              content: 'Unlike classical bits that can be either 0 or 1, qubits can exist in a superposition of both states simultaneously, represented as |ψ⟩ = α|0⟩ + β|1⟩, where α and β are complex amplitudes.'
            },
            {
              title: 'Entanglement',
              content: 'Quantum entanglement occurs when the quantum state of each particle cannot be described independently of the others, regardless of the distance separating them.'
            }
          ]
        },
        {
          title: 'Quantum Computing Algorithms',
          content: 'The lecture covered several important quantum algorithms that demonstrate quantum advantage...',
          subsections: [
            {
              title: 'Grover\'s Algorithm',
              content: 'This algorithm provides a quadratic speedup for unstructured search problems, reducing complexity from O(N) to O(√N).'
            },
            {
              title: 'Shor\'s Algorithm',
              content: 'Peter Shor\'s algorithm can factor large integers in polynomial time, which has significant implications for cryptography based on the hardness of factoring.'
            }
          ]
        }
      ]
    }
  };
  
  const handleCopyToClipboard = () => {
    const textContent = `
      ${dummyNote.title}
      
      Summary:
      ${dummyNote.content.summary}
      
      Key Points:
      ${dummyNote.content.keyPoints.map(point => `- ${point}`).join('\n')}
      
      ${dummyNote.content.sections.map(section => `
        ${section.title}
        ${section.content}
        
        ${section.subsections.map(subsection => `
          ${subsection.title}
          ${subsection.content}
        `).join('\n')}
      `).join('\n')}
    `;
    
    navigator.clipboard.writeText(textContent.trim());
  };
  
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Button 
            variant="ghost" 
            className="gap-2"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Notes
          </Button>
          
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={handleCopyToClipboard}>
              <Copy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Export as Text
            </Button>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Export as PDF
            </Button>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border border-border/50 shadow-sm overflow-hidden">
          <div className="p-6 bg-muted/30">
            <h1 className="text-2xl font-semibold">{dummyNote.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {dummyNote.date.toLocaleDateString()} • {dummyNote.date.toLocaleTimeString()}
            </p>
          </div>
          
          <div className="p-6">
            <div className="prose prose-sm max-w-none">
              <h2 className="text-xl font-medium mb-2">Summary</h2>
              <p className="mb-6">{dummyNote.content.summary}</p>
              
              <h2 className="text-xl font-medium mb-2">Key Points</h2>
              <ul className="mb-6">
                {dummyNote.content.keyPoints.map((point, index) => (
                  <li key={index} className="mb-1">{point}</li>
                ))}
              </ul>
              
              <Separator className="my-6" />
              
              {dummyNote.content.sections.map((section, index) => (
                <div key={index} className="mb-6">
                  <h2 className="text-xl font-medium mb-2">{section.title}</h2>
                  <p className="mb-4">{section.content}</p>
                  
                  {section.subsections.map((subsection, subIndex) => (
                    <div key={subIndex} className="mb-4 ml-4">
                      <h3 className="text-lg font-medium mb-1">{subsection.title}</h3>
                      <p>{subsection.content}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default NotesView;
