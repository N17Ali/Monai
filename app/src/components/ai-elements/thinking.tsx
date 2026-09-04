import "three-dots/dist/three-dots.css";
import { cn } from "@/lib/utils";

export function ThinkingDots({ className, label = "در حال پاسخ" }: { className?: string; label?: string }) {
  return (
    <span aria-label={label} className={cn("chat-thinking inline-flex", className)} role="status">
      <span className="dot-elastic" />
    </span>
  );
}
