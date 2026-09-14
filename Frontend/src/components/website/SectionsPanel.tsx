import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteSection } from "./types";

const SECTION_LABELS: Record<string, string> = {
  hero: "Hero",
  about: "About",
  services: "Services",
  gallery: "Gallery",
  testimonials: "Testimonials",
  contactBooking: "Contact / Booking",
  footer: "Footer",
};

function SortableRow({
  section,
  onToggleVisible,
}: {
  section: SiteSection;
  onToggleVisible: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5",
        isDragging && "opacity-50",
        !section.visible && "opacity-50",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex-1 text-sm font-medium">
        {SECTION_LABELS[section.type] ?? section.type}
      </span>
      <button
        onClick={onToggleVisible}
        className="text-muted-foreground hover:text-foreground"
        title={section.visible ? "Hide section" : "Show section"}
      >
        {section.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </button>
    </div>
  );
}

export function SectionsPanel({
  sections,
  onChange,
}: {
  sections: SiteSection[];
  onChange: (sections: SiteSection[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(sections, oldIndex, newIndex));
  };

  const toggleVisible = (id: string) => {
    onChange(sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-muted-foreground">Sections</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {sections.map((section) => (
              <SortableRow
                key={section.id}
                section={section}
                onToggleVisible={() => toggleVisible(section.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="mt-3 text-xs text-muted-foreground">
        Drag to reorder. Hide a section instead of deleting it if you might want it back.
      </p>
    </div>
  );
}
