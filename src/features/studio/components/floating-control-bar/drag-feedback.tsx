"use client";

export function DropErrorToast({ message }: { message: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 absolute inset-x-0 -top-10 flex justify-center">
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive shadow-lg backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
}

export function DragHintToast({ message }: { message: string }) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 absolute inset-x-0 -top-10 flex justify-center">
      <div className="rounded-lg border border-primary/30 bg-primary/12 px-3 py-1.5 text-xs font-medium text-primary shadow-lg backdrop-blur-sm">
        {message}
      </div>
    </div>
  );
}
