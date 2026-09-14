import { useState } from "react";
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
import { Eye, EyeOff, GripVertical, Home, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PAGE_PRESETS } from "./templates";
import type { SitePage } from "./types";

function SortableRow({
  page,
  selected,
  onSelect,
  onToggleNav,
  onDelete,
}: {
  page: SitePage;
  selected: boolean;
  onSelect: () => void;
  onToggleNav: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-2.5 py-2",
        selected ? "border-[var(--grad-to)] bg-accent" : "bg-card",
        isDragging && "opacity-50",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="size-4" />
      </button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
        {page.isHome ? <Home className="size-3.5 shrink-0 text-muted-foreground" /> : null}
        <span className="truncate text-sm font-medium">{page.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          /{page.slug}
          {page.slug ? "/" : ""}
        </span>
      </button>
      <button
        onClick={onToggleNav}
        title={page.showInNav ? "Hide from menu" : "Show in menu"}
        className="text-muted-foreground hover:text-foreground"
      >
        {page.showInNav ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </button>
      {!page.isHome ? (
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function PagesPanel({
  pages,
  selectedPageId,
  onSelect,
  onReorder,
  onToggleNav,
  onDelete,
  onAdd,
}: {
  pages: SitePage[];
  selectedPageId: string | null;
  onSelect: (pageId: string) => void;
  onReorder: (pageIds: string[]) => void;
  onToggleNav: (pageId: string, showInNav: boolean) => void;
  onDelete: (pageId: string) => void;
  onAdd: (name: string, preset: string) => Promise<void>;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [preset, setPreset] = useState<string>(PAGE_PRESETS[0].id);
  const [busy, setBusy] = useState(false);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p) => p.id === active.id);
    const newIndex = pages.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(pages, oldIndex, newIndex).map((p) => p.id));
  };

  const submitAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onAdd(name, preset);
      setNewName("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">Pages</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-3.5" /> Add
        </Button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {pages.map((page) => (
              <SortableRow
                key={page.id}
                page={page}
                selected={page.id === selectedPageId}
                onSelect={() => onSelect(page.id)}
                onToggleNav={() => onToggleNav(page.id, !page.showInNav)}
                onDelete={() => onDelete(page.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {adding ? (
        <div className="mt-3 space-y-2 rounded-lg border p-3">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Page name (e.g. Pricing)"
            onKeyDown={(e) => {
              if (e.key === "Enter") void submitAdd();
              if (e.key === "Escape") setAdding(false);
            }}
          />
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  Start from: {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" onClick={submitAdd} disabled={busy || !newName.trim()}>
              Add page
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
