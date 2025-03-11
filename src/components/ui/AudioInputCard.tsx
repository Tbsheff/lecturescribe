
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface AudioInputCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isActive?: boolean;
  onClick: () => void;
}

export const AudioInputCard: React.FC<AudioInputCardProps> = ({
  icon,
  title,
  description,
  isActive = false,
  onClick,
}) => {
  return (
    <Card
      className={cn(
        "w-full border cursor-pointer transition-all duration-300 card-hover",
        isActive
          ? "border-brand bg-brand/5"
          : "border-border/50 hover:border-brand/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn(
            "rounded-full p-3",
            isActive ? "bg-brand/10 text-brand" : "bg-secondary text-muted-foreground"
          )}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
