/** "01 / ABOUT" style section marker used above a big headline. */
export function SectionLabel({ index, children }: { index: number; children: string }) {
  return (
    <p className="label-tag">
      {String(index).padStart(2, "0")} / {children}
    </p>
  );
}
