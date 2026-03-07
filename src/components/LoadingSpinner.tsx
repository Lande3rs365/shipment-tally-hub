import { Loader2 } from "lucide-react";

export default function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-primary animate-spin mb-3" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
