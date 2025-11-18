import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertBrandSchema, type InsertBrand, type Brand } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface BrandFormProps {
  brand?: Brand;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<InsertBrand>) => Promise<void>;
}

export function BrandForm({ brand, open, onOpenChange, onSubmit }: BrandFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<Partial<InsertBrand>>({
    resolver: zodResolver(insertBrandSchema.partial()),
  });

  useEffect(() => {
    if (brand && open) {
      reset({
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        logoUrl: brand.logoUrl || undefined,
        articleContent: brand.articleContent || undefined,
      });
    } else if (!brand && open) {
      reset({});
    }
  }, [brand, open, reset]);

  const onFormSubmit = async (data: Partial<InsertBrand>) => {
    await onSubmit(data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{brand ? "Edit Brand" : "Create New Brand"}</DialogTitle>
          <DialogDescription>
            {brand ? "Update brand details below." : "Fill in the details to create a new brand."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
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
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              rows={3}
              {...register("description")}
              placeholder="Brief description of the brand"
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input id="logoUrl" {...register("logoUrl")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="articleContent">Article Content</Label>
            <Textarea
              id="articleContent"
              rows={12}
              {...register("articleContent")}
              placeholder="Brand story/article content (HTML supported)"
              className="font-mono text-sm"
            />
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
                brand ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

