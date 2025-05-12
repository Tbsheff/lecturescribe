import React from "react";
import { Link } from "react-router-dom";

export function Footer() {
  return (
    <div className="z-20 w-full bg-background/95 shadow backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-4 md:mx-8 flex h-14 items-center">
        <p className="text-xs md:text-sm leading-loose text-muted-foreground text-left">
          LectureScribe {new Date().getFullYear()} - Transform lectures into structured notes with AI
        </p>
      </div>
    </div>
  );
}
