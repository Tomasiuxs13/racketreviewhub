import { useLocation } from "wouter";
import type { Guide } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-react";

interface GuideTableProps {
  guides: Guide[];
  onEdit: (guide: Guide) => void;
}

export function GuideTable({ guides, onEdit }: GuideTableProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Published</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guides.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                No guides found
              </TableCell>
            </TableRow>
          ) : (
            guides.map((guide) => (
              <TableRow 
                key={guide.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={(e) => {
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
                  setLocation(`/guides/${guide.slug}`);
                }}
              >
                <TableCell className="font-medium">{guide.title}</TableCell>
                <TableCell className="text-muted-foreground">{guide.slug}</TableCell>
                <TableCell className="capitalize">{guide.category}</TableCell>
                <TableCell>
                  {new Date(guide.publishedAt).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(guide);
                    }}
                    title="Edit guide"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}


