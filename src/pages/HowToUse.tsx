
import React from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Separator } from '@/components/ui/separator';
import { Mic, Upload, FileText, Glasses, Download } from 'lucide-react';

const HowToUse = () => {
  const steps = [
    {
      icon: <Mic className="h-6 w-6" />,
      title: 'Record or Upload Audio',
      description: 'Use your microphone to record a lecture in real-time or upload an existing audio file in MP3, WAV, or M4A format.'
    },
    {
      icon: <Glasses className="h-6 w-6" />,
      title: 'AI Processing',
      description: 'Our AI system will transcribe the audio and generate structured notes with headings, bullet points, and summaries.'
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: 'Review and Edit',
      description: 'Review the generated notes, make any necessary edits, and customize the content to your preferences.'
    },
    {
      icon: <Download className="h-6 w-6" />,
      title: 'Export and Share',
      description: 'Export your notes in various formats (PDF, Word, Text) or share them directly with classmates or colleagues.'
    }
  ];

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2 gradient-text">How to Use LectureScribe</h1>
        <p className="text-muted-foreground mb-8">
          Follow these simple steps to transform lectures into comprehensive notes
        </p>

        <div className="bg-card border border-border/50 rounded-lg overflow-hidden shadow-sm p-8">
          <div className="grid grid-cols-1 gap-8">
            {steps.map((step, index) => (
              <div key={index} className="flex">
                <div className="mr-6">
                  <div className="flex items-center justify-center h-12 w-12 rounded-full bg-brand/10 text-brand">
                    {step.icon}
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    {index + 1}. {step.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {step.description}
                  </p>
                  {index < steps.length - 1 && (
                    <div className="my-4 ml-6 border-l-2 border-dashed border-muted h-8"></div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-8" />

          <div className="mt-6">
            <h2 className="text-xl font-medium mb-3">Tips for Best Results</h2>
            <ul className="space-y-2">
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs mr-3 mt-0.5">•</div>
                <p>Use a good quality microphone when recording lectures.</p>
              </li>
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs mr-3 mt-0.5">•</div>
                <p>Position yourself close to the speaker for better audio quality.</p>
              </li>
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs mr-3 mt-0.5">•</div>
                <p>Minimize background noise during recordings.</p>
              </li>
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs mr-3 mt-0.5">•</div>
                <p>For longer lectures, consider breaking them into smaller segments.</p>
              </li>
              <li className="flex items-start">
                <div className="h-5 w-5 rounded-full bg-brand/20 text-brand flex items-center justify-center text-xs mr-3 mt-0.5">•</div>
                <p>Always review the AI-generated notes for accuracy.</p>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default HowToUse;
