import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Typewriter that cycles through `words`, typing and deleting each one,
 *  with a blinking caret at the end. Freezes on the first word if the
 *  viewer prefers reduced motion. */
export function TypingLine({
  prefix,
  words,
  className,
}: {
  prefix: string;
  words: string[];
  className?: string;
}) {
  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState(reduced ? (words[0] ?? "") : "");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const current = words[wordIndex % words.length] ?? "";
    const typingSpeed = deleting ? 35 : 65;
    const pauseAtFullWord = 1500;

    let timeout: ReturnType<typeof setTimeout>;
    if (!deleting && text === current) {
      timeout = setTimeout(() => setDeleting(true), pauseAtFullWord);
    } else if (deleting && text === "") {
      setDeleting(false);
      setWordIndex((i) => i + 1);
    } else {
      timeout = setTimeout(() => {
        setText((t) =>
          deleting ? current.slice(0, t.length - 1) : current.slice(0, t.length + 1),
        );
      }, typingSpeed);
    }
    return () => clearTimeout(timeout);
  }, [text, deleting, wordIndex, words, reduced]);

  return (
    <span className={cn(className)}>
      {prefix}
      <span className="font-semibold text-foreground">{text}</span>
      <span className="cursor-blink text-[var(--grad-to)]" />
    </span>
  );
}
