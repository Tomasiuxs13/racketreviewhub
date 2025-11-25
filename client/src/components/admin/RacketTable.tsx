import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import type { Racket } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Edit, Trash2, Sparkles, Loader2 } from "lucide-react";

interface RacketTableProps {
  rackets: Racket[];
  onEdit: (racket: Racket) => void;
}

export function RacketTable({ rackets, onEdit }: RacketTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/rackets/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Racket deleted",
        description: "The racket has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateReviewMutation = useMutation({
    mutationFn: async (id: string) => {
      setGeneratingId(id);
      const response = await apiRequest("POST", `/api/admin/generate-review/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Review generated",
        description: "The review has been generated successfully using ChatGPT.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
      setGeneratingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Review generation failed",
        description: error.message || "Failed to generate review. Please check your OpenAI API key.",
        variant: "destructive",
      });
      setGeneratingId(null);
    },
  });

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Brand</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Shape</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Original Price</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rackets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No rackets found
                </TableCell>
              </TableRow>
            ) : (
              rackets.map((racket) => (
                <TableRow 
                  key={racket.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={(e) => {
                    // Don't navigate if clicking on buttons or their containers
                    const target = e.target as HTMLElement;
                    if (
                      target.closest('button') ||
                      target.closest('[role="button"]') ||
                      target.tagName === 'BUTTON' ||
                      target.tagName === 'SVG' ||
                      target.closest('svg')
                    ) {
                      return;
                    }
                    setLocation(`/rackets/${racket.id}`);
                  }}
                >
                  <TableCell className="font-medium">{racket.brand}</TableCell>
                  <TableCell>{racket.model}</TableCell>
                  <TableCell>{racket.year}</TableCell>
                  <TableCell className="capitalize">{racket.shape}</TableCell>
                  <TableCell>{racket.overallRating}/100</TableCell>
                  <TableCell>
                    {racket.currentPrice ? `$${Number(racket.currentPrice).toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell>
                    {racket.originalPrice ? `$${Number(racket.originalPrice).toFixed(2)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          generateReviewMutation.mutate(racket.id);
                        }}
                        disabled={generatingId === racket.id}
                        title="Generate review with ChatGPT"
                      >
                        {generatingId === racket.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(racket);
                        }}
                        title="Edit racket"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(racket.id);
                        }}
                        title="Delete racket"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the racket.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}




