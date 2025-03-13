import React from 'react';

interface AudioVisualizerProps {
  audioData: number[];
  isRecording: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ 
  audioData, 
  isRecording 
}) => {
  return (
    <div className="flex items-end justify-center h-24 gap-[2px] mt-4">
      {isRecording ? (
        audioData.map((value, index) => (
          <div
            key={index}
            className="w-1 bg-brand rounded-t-sm animate-wave"
            style={{
              height: `${(value / 255) * 100}%`,
              animationDelay: `${index * 0.05}s`,
              opacity: 0.7 + (value / 255) * 0.3,
            }}
          ></div>
        ))
      ) : (
        Array.from({ length: 32 }).map((_, index) => (
          <div
            key={index}
            className="w-1 bg-muted-foreground/30 rounded-t-sm"
            style={{ height: `${5 + Math.random() * 15}%` }}
          ></div>
        ))
      )}
    </div>
  );
};
