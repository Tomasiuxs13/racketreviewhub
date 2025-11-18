import { useLocation } from "wouter";
import type { Brand } from "@shared/schema";
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

interface BrandTableProps {
  brands: Brand[];
  onEdit: (brand: Brand) => void;
}

export function BrandTable({ brands, onEdit }: BrandTableProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {brands.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                No brands found
              </TableCell>
            </TableRow>
          ) : (
            brands.map((brand) => (
              <TableRow 
                key={brand.id}
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
                  setLocation(`/brands/${brand.slug}`);
                }}
              >
                <TableCell className="font-medium">{brand.name}</TableCell>
                <TableCell className="text-muted-foreground">{brand.slug}</TableCell>
                <TableCell className="max-w-md truncate">{brand.description}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(brand);
                    }}
                    title="Edit brand"
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


