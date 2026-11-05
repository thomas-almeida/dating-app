import { APP_NAME } from "@/lib/config";

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-2xl font-semibold tracking-tight ${className}`}>
      {APP_NAME}
      <span className="text-coral">.</span>
    </span>
  );
}
