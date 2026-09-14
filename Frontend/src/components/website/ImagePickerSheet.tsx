import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, Upload } from "lucide-react";

export function ImagePickerSheet({
  open,
  onOpenChange,
  orgId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  orgId: string;
  onPick: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const path = `${orgId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("website-assets").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("website-assets").getPublicUrl(path);
      onPick(data.publicUrl);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload that image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Choose an image</SheetTitle>
          <SheetDescription>Upload your own photo, or paste an image URL.</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-4 py-5">
          <div className="space-y-2">
            <Label>Upload</Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-8 text-sm text-muted-foreground hover:border-[var(--grad-to)]">
              {uploading ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Upload className="size-5" />
              )}
              {uploading ? "Uploading…" : "Click to choose a file"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                }}
              />
            </label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="image-url">Or paste a URL</Label>
            <div className="flex gap-2">
              <Input
                id="image-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
              <Button
                variant="outline"
                disabled={!url.trim()}
                onClick={() => {
                  onPick(url.trim());
                  setUrl("");
                  onOpenChange(false);
                }}
              >
                Use
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
