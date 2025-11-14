import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Brand } from "@shared/schema";

export default function BrandsPage() {
  const { data: brands, isLoading } = useQuery<Brand[]>({
    queryKey: ["/api/brands"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-3" data-testid="text-page-title">
            Padel Racket Brands
          </h1>
          <p className="text-muted-foreground text-lg">
            Explore in-depth articles and top racket recommendations from leading padel brands
          </p>
        </div>

        {/* Brands Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-16 w-16 rounded-md mb-4" />
                  <Skeleton className="h-8 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : brands && brands.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {brands.map((brand) => (
              <Link key={brand.id} href={`/brands/${brand.slug}`} data-testid={`link-brand-${brand.id}`}>
                <Card className="h-full hover-elevate active-elevate-2 transition-all cursor-pointer" data-testid={`card-brand-${brand.id}`}>
                  <CardHeader>
                    {brand.logoUrl && (
                      <div className="w-16 h-16 mb-4 flex items-center justify-center">
                        <img
                          src={brand.logoUrl}
                          alt={`${brand.name} logo`}
                          className="max-w-full max-h-full object-contain"
                          data-testid={`img-brand-logo-${brand.id}`}
                        />
                      </div>
                    )}
                    <CardTitle className="text-2xl" data-testid={`text-brand-name-${brand.id}`}>
                      {brand.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground line-clamp-3">
                      {brand.description}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <p className="text-muted-foreground text-center">
                No brands available yet. Check back soon!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
