import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertRacketSchema, type InsertRacket, type Racket } from "@shared/schema";
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

interface RacketFormProps {
  racket?: Racket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: InsertRacket) => Promise<void>;
}

export function RacketForm({ racket, open, onOpenChange, onSubmit }: RacketFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
  } = useForm<InsertRacket>({
    resolver: zodResolver(insertRacketSchema),
    defaultValues: {
      year: new Date().getFullYear(),
      shape: "round",
      powerRating: 50,
      controlRating: 50,
      reboundRating: 50,
      maneuverabilityRating: 50,
      sweetSpotRating: 50,
    },
  });

  // Update form values when racket prop changes
  useEffect(() => {
    if (racket && open) {
      reset({
        brand: racket.brand,
        model: racket.model,
        year: racket.year,
        shape: racket.shape as "diamond" | "round" | "teardrop",
        powerRating: racket.powerRating,
        controlRating: racket.controlRating,
        reboundRating: racket.reboundRating,
        maneuverabilityRating: racket.maneuverabilityRating,
        sweetSpotRating: racket.sweetSpotRating,
        currentPrice: racket.currentPrice || "",
        originalPrice: racket.originalPrice || undefined,
        imageUrl: racket.imageUrl || undefined,
        affiliateLink: racket.affiliateLink || undefined,
        titleUrl: racket.titleUrl || undefined,
        reviewContent: racket.reviewContent || undefined,
        // Specification fields
        color: racket.color || undefined,
        balance: racket.balance || undefined,
        surface: racket.surface || undefined,
        hardness: racket.hardness || undefined,
        finish: racket.finish || undefined,
        playersCollection: racket.playersCollection || undefined,
        product: racket.product || undefined,
        core: racket.core || undefined,
        format: racket.format || undefined,
        gameLevel: racket.gameLevel || undefined,
        gameType: racket.gameType || undefined,
        player: racket.player as "man" | "woman" | "both" | undefined,
      });
    } else if (!racket && open) {
      // Reset to default values for new racket
      reset({
        year: new Date().getFullYear(),
        shape: "round",
        powerRating: 50,
        controlRating: 50,
        reboundRating: 50,
        maneuverabilityRating: 50,
        sweetSpotRating: 50,
      });
    }
  }, [racket, open, reset]);

  const shape = watch("shape");

  const onFormSubmit = async (data: InsertRacket) => {
    await onSubmit(data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{racket ? "Edit Racket" : "Create New Racket"}</DialogTitle>
          <DialogDescription>
            {racket ? "Update racket details below." : "Fill in the details to create a new racket."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input id="brand" {...register("brand")} />
              {errors.brand && (
                <p className="text-sm text-destructive">{errors.brand.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model *</Label>
              <Input id="model" {...register("model")} />
              {errors.model && (
                <p className="text-sm text-destructive">{errors.model.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                {...register("year", { valueAsNumber: true })}
              />
              {errors.year && (
                <p className="text-sm text-destructive">{errors.year.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="shape">Shape *</Label>
              <Select
                value={shape}
                onValueChange={(value) => setValue("shape", value as "diamond" | "round" | "teardrop")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diamond">Diamond</SelectItem>
                  <SelectItem value="round">Round</SelectItem>
                  <SelectItem value="teardrop">Teardrop</SelectItem>
                </SelectContent>
              </Select>
              {errors.shape && (
                <p className="text-sm text-destructive">{errors.shape.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ratings (0-100) *</Label>
            <div className="grid grid-cols-5 gap-2">
              <div>
                <Label htmlFor="powerRating" className="text-xs">Power</Label>
                <Input
                  id="powerRating"
                  type="number"
                  min="0"
                  max="100"
                  {...register("powerRating", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="controlRating" className="text-xs">Control</Label>
                <Input
                  id="controlRating"
                  type="number"
                  min="0"
                  max="100"
                  {...register("controlRating", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="reboundRating" className="text-xs">Rebound</Label>
                <Input
                  id="reboundRating"
                  type="number"
                  min="0"
                  max="100"
                  {...register("reboundRating", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="maneuverabilityRating" className="text-xs">Maneuverability</Label>
                <Input
                  id="maneuverabilityRating"
                  type="number"
                  min="0"
                  max="100"
                  {...register("maneuverabilityRating", { valueAsNumber: true })}
                />
              </div>
              <div>
                <Label htmlFor="sweetSpotRating" className="text-xs">Sweet Spot</Label>
                <Input
                  id="sweetSpotRating"
                  type="number"
                  min="0"
                  max="100"
                  {...register("sweetSpotRating", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Current Price *</Label>
              <Input
                id="currentPrice"
                type="number"
                step="0.01"
                {...register("currentPrice", { 
                  setValueAs: (v) => v === "" ? "" : String(Number(v).toFixed(2))
                })}
              />
              {errors.currentPrice && (
                <p className="text-sm text-destructive">{errors.currentPrice.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="originalPrice">Original Price</Label>
              <Input
                id="originalPrice"
                type="number"
                step="0.01"
                {...register("originalPrice", { 
                  setValueAs: (v) => v === "" ? undefined : String(Number(v).toFixed(2))
                })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input id="imageUrl" {...register("imageUrl")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="affiliateLink">Affiliate Link</Label>
            <Input id="affiliateLink" {...register("affiliateLink")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="titleUrl">Title URL</Label>
            <Input id="titleUrl" {...register("titleUrl")} placeholder="Product URL from Excel" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reviewContent">Review Content</Label>
            <Textarea
              id="reviewContent"
              rows={6}
              {...register("reviewContent")}
              placeholder="Enter review content (HTML supported)"
            />
          </div>

          {/* Specification Fields */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold text-sm">Specification Fields</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input id="color" {...register("color")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Balance</Label>
                <Input id="balance" {...register("balance")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surface">Surface</Label>
                <Input id="surface" {...register("surface")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hardness">Hardness</Label>
                <Input id="hardness" {...register("hardness")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="finish">Finish</Label>
                <Input id="finish" {...register("finish")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="core">Core</Label>
                <Input id="core" {...register("core")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="playersCollection">Players Collection</Label>
                <Input id="playersCollection" {...register("playersCollection")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="product">Product</Label>
                <Input id="product" {...register("product")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Input id="format" {...register("format")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gameLevel">Game Level</Label>
                <Input id="gameLevel" {...register("gameLevel")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gameType">Game Type</Label>
                <Input id="gameType" {...register("gameType")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="player">Player (Gender)</Label>
                <Select
                  value={watch("player") || ""}
                  onValueChange={(value) => setValue("player", value as "man" | "woman" | "both" | undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="man">Man</SelectItem>
                    <SelectItem value="woman">Woman</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
                racket ? "Update" : "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

