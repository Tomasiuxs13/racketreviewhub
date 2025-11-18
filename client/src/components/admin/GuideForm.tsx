import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertGuideSchema, type InsertGuide, type Guide } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface GuideFormProps {
  guide?: Guide;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<InsertGuide>) => Promise<void>;
}

export function GuideForm({ guide, open, onOpenChange, onSubmit }: GuideFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<Partial<InsertGuide>>({
    resolver: zodResolver(insertGuideSchema.partial()),
  });

  useEffect(() => {
    if (guide && open) {
      reset({
        title: guide.title,
        slug: guide.slug,
        excerpt: guide.excerpt,
        content: guide.content,
        category: guide.category as "beginners" | "intermediate" | "advanced" | "general",
        featuredImage: guide.featuredImage || undefined,
      });
    } else if (!guide && open) {
      reset({
        category: "general",
      });
    }
  }, [guide, open, reset]);

  const category = watch("category");

  const onFormSubmit = async (data: Partial<InsertGuide>) => {
    await onSubmit(data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{guide ? "Edit Guide" : "Create New Guide"}</DialogTitle>
          <DialogDescription>
            {guide ? "Update guide details below." : "Fill in the details to create a new guide."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register("title")} />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input id="slug" {...register("slug")} placeholder="url-friendly-slug" />
            {errors.slug && (
              <p className="text-sm text-destructive">{errors.slug.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt *</Label>
            <Textarea
              id="excerpt"
              rows={3}
              {...register("excerpt")}
              placeholder="Brief description of the guide"
            />
            {errors.excerpt && (
              <p className="text-sm text-destructive">{errors.excerpt.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={category}
              onValueChange={(value) => setValue("category", value as "beginners" | "intermediate" | "advanced" | "general")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginners">Beginners</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-destructive">{errors.category.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="featuredImage">Featured Image URL</Label>
            <Input id="featuredImage" {...register("featuredImage")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content *</Label>
            <Textarea
              id="content"
              rows={12}
              {...register("content")}
              placeholder="Guide content (HTML supported)"
              className="font-mono text-sm"
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                guide ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


