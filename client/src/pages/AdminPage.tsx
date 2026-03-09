import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, AlertCircle, Loader2, Plus, X, RefreshCw, Clock, Eye, EyeOff, Zap, Trash2, FileSpreadsheet, BarChart3, Package, ShoppingCart, TrendingUp, Search, Filter } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { InsertRacket, Racket, Guide, Brand, BlogPost, InsertGuide, InsertBrand, InsertBlogPost } from "@shared/schema";
import { RacketForm } from "@/components/admin/RacketForm";
import { RacketTable } from "@/components/admin/RacketTable";
import { GuideForm } from "@/components/admin/GuideForm";
import { GuideTable } from "@/components/admin/GuideTable";
import { BrandForm } from "@/components/admin/BrandForm";
import { BrandTable } from "@/components/admin/BrandTable";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { BlogPostTable } from "@/components/admin/BlogPostTable";
import { Checkbox } from "@/components/ui/checkbox";
import SEO from "@/components/SEO";

interface CjSyncResult {
  success: boolean;
  message: string;
  totalProcessed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  totalProducts?: number;
  padelRackets?: number;
  duration?: number;
}

interface PadelMarketSyncResult {
  success: boolean;
  message: string;
  totalProcessed: number;
  matched: number;
  updated: number;
  unchanged: number;
  skipped: number;
  markedOutOfStock: number;
  errors: string[];
  totalProducts?: number;
  rackets?: number;
  duration?: number;
}

interface AdminStats {
  rackets: {
    total: number;
    published: number;
    pending: number;
    inStock: number;
    outOfStock: number;
    withPadelMarket: number;
    withPadelNuestro: number;
  };
  guides: { total: number };
  brands: { total: number };
  blogPosts: { total: number };
  recentActivity: {
    recentRackets: Array<{
      id: string;
      brand: string;
      model: string;
      createdAt: string;
      isPublished: boolean;
    }>;
  };
}

export default function AdminPage() {
  const [editingRacket, setEditingRacket] = useState<Racket | undefined>(undefined);
  const [editingGuide, setEditingGuide] = useState<Guide | undefined>(undefined);
  const [editingBrand, setEditingBrand] = useState<Brand | undefined>(undefined);
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [guideFormOpen, setGuideFormOpen] = useState(false);
  const [brandFormOpen, setBrandFormOpen] = useState(false);
  const [postFormOpen, setPostFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPublished, setFilterPublished] = useState<boolean | null>(null);
  const [filterInStock, setFilterInStock] = useState<boolean | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rackets for the table
  const { data: rackets = [], isLoading: racketsLoading } = useQuery<Racket[]>({
    queryKey: ["/api/admin/rackets"],
  });

  // Fetch guides for the table
  const { data: guides = [], isLoading: guidesLoading } = useQuery<Guide[]>({
    queryKey: ["/api/admin/guides"],
  });

  // Fetch brands for the table
  const { data: brands = [], isLoading: brandsLoading } = useQuery<Brand[]>({
    queryKey: ["/api/admin/brands"],
  });

  // Fetch blog posts for the table
  const { data: posts = [], isLoading: postsLoading } = useQuery<BlogPost[]>({
    queryKey: ["/api/admin/blog"],
  });

  // Fetch pending rackets
  const { data: pendingRackets = [], isLoading: pendingLoading, refetch: refetchPending } = useQuery<Racket[]>({
    queryKey: ["/api/admin/pending-rackets"],
  });

  // Fetch admin statistics
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Selected pending rackets for bulk actions
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

  const createMutation = useMutation({
    mutationFn: async (data: InsertRacket) => {
      const response = await apiRequest("POST", "/api/admin/rackets", data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Racket created",
        description: "The racket has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Create failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertRacket> }) => {
      const response = await apiRequest("PUT", `/api/admin/rackets/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Racket updated",
        description: "The racket has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFormSubmit = async (data: InsertRacket) => {
    if (editingRacket) {
      await updateMutation.mutateAsync({ id: editingRacket.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    setEditingRacket(undefined);
  };

  const handleEdit = (racket: Racket) => {
    setEditingRacket(racket);
    setFormOpen(true);
  };

  const handleCreate = () => {
    setEditingRacket(undefined);
    setFormOpen(true);
  };

  // Guide mutations
  const updateGuideMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertGuide> }) => {
      const response = await apiRequest("PUT", `/api/admin/guides/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Guide updated",
        description: "The guide has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/guides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/guides"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleGuideSubmit = async (data: Partial<InsertGuide>) => {
    if (editingGuide) {
      await updateGuideMutation.mutateAsync({ id: editingGuide.id, data });
    }
    setEditingGuide(undefined);
  };

  const handleEditGuide = (guide: Guide) => {
    setEditingGuide(guide);
    setGuideFormOpen(true);
  };

  // Brand mutations
  const updateBrandMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertBrand> }) => {
      const response = await apiRequest("PUT", `/api/admin/brands/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Brand updated",
        description: "The brand has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/brands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/brands"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBrandSubmit = async (data: Partial<InsertBrand>) => {
    if (editingBrand) {
      await updateBrandMutation.mutateAsync({ id: editingBrand.id, data });
    }
    setEditingBrand(undefined);
  };

  const handleEditBrand = (brand: Brand) => {
    setEditingBrand(brand);
    setBrandFormOpen(true);
  };

  // Blog post mutations
  const updatePostMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertBlogPost> }) => {
      const response = await apiRequest("PUT", `/api/admin/blog/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Blog post updated",
        description: "The blog post has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blog"] });
      queryClient.invalidateQueries({ queryKey: ["/api/blog"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePostSubmit = async (data: Partial<InsertBlogPost>) => {
    if (editingPost) {
      await updatePostMutation.mutateAsync({ id: editingPost.id, data });
    }
    setEditingPost(undefined);
  };

  const handleEditPost = (post: BlogPost) => {
    setEditingPost(post);
    setPostFormOpen(true);
  };

  // CJ Sync mutations
  const cjSyncMutation = useMutation({
    mutationFn: async (quick: boolean = false) => {
      const endpoint = quick ? "/api/admin/cj-sync/quick" : "/api/admin/cj-sync";
      const response = await apiRequest("POST", endpoint, {});
      return await response.json() as CjSyncResult;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Sync completed" : "Sync completed with errors",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cjLocalSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/cj-sync/local", {
        generateRatings: true,
        generateReviews: true,
      });
      return await response.json() as CjSyncResult;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Local sync completed" : "Local sync completed with errors",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Local sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Padel Market Sync mutations
  const padelMarketSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/padel-market-sync", {});
      return await response.json() as PadelMarketSyncResult;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Padel Market sync completed" : "Padel Market sync completed with errors",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Padel Market sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const padelMarketLocalSyncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/padel-market-sync/local", {});
      return await response.json() as PadelMarketSyncResult;
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? "Local Padel Market sync completed" : "Local sync completed with errors",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Local Padel Market sync failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Publish/Unpublish mutations
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/admin/publish-racket/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Racket published",
        description: "The racket is now visible to users.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Publish failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await apiRequest("POST", "/api/admin/publish-rackets", { ids });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Rackets published",
        description: `${data.published} rackets are now visible to users.`,
      });
      setSelectedPending(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk publish failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Decline (delete) a pending racket
  const declineMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/admin/rackets/${id}`, {});
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Racket declined",
        description: "The racket has been removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Decline failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Bulk decline (delete) multiple pending rackets
  const bulkDeclineMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(
        ids.map(id => apiRequest("DELETE", `/api/admin/rackets/${id}`, {}))
      );
      return { deleted: results.length };
    },
    onSuccess: (data) => {
      toast({
        title: "Rackets declined",
        description: `${data.deleted} rackets have been removed.`,
      });
      setSelectedPending(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-rackets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rackets"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Bulk decline failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleBulkDecline = () => {
    if (selectedPending.size > 0 && confirm(`Are you sure you want to decline ${selectedPending.size} racket(s)? This action cannot be undone.`)) {
      bulkDeclineMutation.mutate(Array.from(selectedPending));
    }
  };

  const handleTogglePendingSelection = (id: string) => {
    const newSelected = new Set(selectedPending);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedPending(newSelected);
  };

  const handleSelectAllPending = () => {
    if (selectedPending.size === pendingRackets.length) {
      setSelectedPending(new Set());
    } else {
      setSelectedPending(new Set(pendingRackets.map(r => r.id)));
    }
  };

  const handleBulkPublish = () => {
    if (selectedPending.size > 0) {
      bulkPublishMutation.mutate(Array.from(selectedPending));
    }
  };

  return (
    <>
      <SEO title="Admin Panel" noindex />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading font-bold text-4xl md:text-5xl mb-3" data-testid="text-page-title">
              Admin Panel
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage rackets, upload files, and edit racket details
            </p>
          </div>

          <Tabs defaultValue="dashboard" className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="dashboard">
                <BarChart3 className="mr-2 h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="manage">Manage Rackets</TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pending Review
                {pendingRackets.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 min-w-5 px-1">
                    {pendingRackets.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cj-sync">CJ Sync</TabsTrigger>
              <TabsTrigger value="padel-market-sync">Padel Market Sync</TabsTrigger>
              <TabsTrigger value="guides">Guides</TabsTrigger>
              <TabsTrigger value="brands">Brands</TabsTrigger>
              <TabsTrigger value="blog">Blog Posts</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Dashboard</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Overview of your racket catalog and system status
                  </p>
                </div>
                <Button variant="outline" onClick={() => refetchStats()}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${statsLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>

              {statsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : stats ? (
                <>
                  {/* Statistics Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Rackets</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.rackets.total}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.rackets.published} published, {stats.rackets.pending} pending
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">In Stock</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.rackets.inStock}</div>
                        <p className="text-xs text-muted-foreground">
                          {stats.rackets.outOfStock} out of stock
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Padel Nuestro</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.rackets.withPadelNuestro}</div>
                        <p className="text-xs text-muted-foreground">
                          Rackets with affiliate links
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Padel Market</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{stats.rackets.withPadelMarket}</div>
                        <p className="text-xs text-muted-foreground">
                          Rackets with alternative links
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Additional Stats */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Content</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Guides</span>
                            <span className="font-medium">{stats.guides.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Brands</span>
                            <span className="font-medium">{stats.brands.total}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Blog Posts</span>
                            <span className="font-medium">{stats.blogPosts.total}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {stats.recentActivity.recentRackets.length > 0 ? (
                            stats.recentActivity.recentRackets.map((racket) => (
                              <div key={racket.id} className="flex items-center justify-between text-sm">
                                <span className="truncate">
                                  {racket.brand} {racket.model}
                                </span>
                                <Badge variant={racket.isPublished ? "default" : "secondary"} className="ml-2">
                                  {racket.isPublished ? "Published" : "Pending"}
                                </Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const manageTab = document.querySelector('[value="manage"]') as HTMLElement;
                            if (manageTab) manageTab.click();
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create Racket
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => {
                            const syncTab = document.querySelector('[value="cj-sync"]') as HTMLElement;
                            if (syncTab) syncTab.click();
                          }}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync CJ Feed
                        </Button>
                        {stats.rackets.pending > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              const pendingTab = document.querySelector('[value="pending"]') as HTMLElement;
                              if (pendingTab) pendingTab.click();
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Review Pending ({stats.rackets.pending})
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </TabsContent>

            <TabsContent value="manage" className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <h2 className="text-2xl font-semibold">Rackets</h2>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search rackets..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 pr-4 py-2 border rounded-md text-sm w-64"
                    />
                  </div>
                  <Button variant="outline" onClick={() => setFilterPublished(filterPublished === null ? true : filterPublished === true ? false : null)}>
                    <Filter className="mr-2 h-4 w-4" />
                    {filterPublished === null ? "All" : filterPublished ? "Published" : "Unpublished"}
                  </Button>
                  <Button variant="outline" onClick={() => setFilterInStock(filterInStock === null ? true : filterInStock === true ? false : null)}>
                    <Filter className="mr-2 h-4 w-4" />
                    {filterInStock === null ? "All Stock" : filterInStock ? "In Stock" : "Out of Stock"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFilterPublished(true);
                      setFilterInStock(true);
                    }}
                    className={filterPublished === true && filterInStock === true ? "bg-primary text-primary-foreground" : ""}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Public & In Stock
                  </Button>
                  <Button onClick={handleCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Racket
                  </Button>
                </div>
              </div>

              {racketsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <RacketTable
                  rackets={rackets.filter(r => {
                    const matchesSearch = !searchQuery ||
                      r.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.model.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesPublishedFilter = filterPublished === null ||
                      (filterPublished ? r.isPublished : !r.isPublished);
                    const matchesStockFilter = filterInStock === null ||
                      (filterInStock ? (r.inStock || r.padelMarketInStock) : (!r.inStock && !r.padelMarketInStock));
                    return matchesSearch && matchesPublishedFilter && matchesStockFilter;
                  })}
                  onEdit={handleEdit}
                />
              )}
            </TabsContent>

            <TabsContent value="pending" className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">Pending Review</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    Rackets imported from CJ feed that need review before publishing
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => refetchPending()}
                    disabled={pendingLoading}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${pendingLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  {selectedPending.size > 0 && (
                    <>
                      <Button
                        variant="destructive"
                        onClick={handleBulkDecline}
                        disabled={bulkDeclineMutation.isPending}
                      >
                        {bulkDeclineMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="mr-2 h-4 w-4" />
                        )}
                        Decline Selected ({selectedPending.size})
                      </Button>
                      <Button
                        onClick={handleBulkPublish}
                        disabled={bulkPublishMutation.isPending}
                      >
                        {bulkPublishMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        Publish Selected ({selectedPending.size})
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {pendingLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : pendingRackets.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-primary mb-4" />
                    <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
                    <p className="text-muted-foreground">
                      No rackets pending review. Run a CJ sync to import new products.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b bg-muted/50">
                          <tr>
                            <th className="p-3 text-left">
                              <Checkbox
                                checked={selectedPending.size === pendingRackets.length && pendingRackets.length > 0}
                                onCheckedChange={handleSelectAllPending}
                              />
                            </th>
                            <th className="p-3 text-left font-medium">Image</th>
                            <th className="p-3 text-left font-medium">Brand</th>
                            <th className="p-3 text-left font-medium">Model</th>
                            <th className="p-3 text-left font-medium">Price</th>
                            <th className="p-3 text-left font-medium">Overall</th>
                            <th className="p-3 text-left font-medium">Added</th>
                            <th className="p-3 text-left font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingRackets.map((racket) => (
                            <tr key={racket.id} className="border-b hover:bg-muted/30">
                              <td className="p-3">
                                <Checkbox
                                  checked={selectedPending.has(racket.id)}
                                  onCheckedChange={() => handleTogglePendingSelection(racket.id)}
                                />
                              </td>
                              <td className="p-3">
                                {racket.imageUrl ? (
                                  <img
                                    src={racket.imageUrl}
                                    alt={`${racket.brand} ${racket.model}`}
                                    className="w-12 h-12 object-contain rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-muted rounded flex items-center justify-center">
                                    <span className="text-xs text-muted-foreground">No img</span>
                                  </div>
                                )}
                              </td>
                              <td className="p-3 font-medium">{racket.brand}</td>
                              <td className="p-3">{racket.model}</td>
                              <td className="p-3">
                                <span className="font-medium">€{racket.currentPrice}</span>
                                {racket.originalPrice && Number(racket.originalPrice) > Number(racket.currentPrice) && (
                                  <span className="text-muted-foreground line-through ml-2 text-sm">
                                    €{racket.originalPrice}
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline">{racket.overallRating}/100</Badge>
                              </td>
                              <td className="p-3 text-sm text-muted-foreground">
                                {new Date(racket.createdAt).toLocaleDateString()}
                              </td>
                              <td className="p-3">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEdit(racket)}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      if (confirm(`Decline "${racket.brand} ${racket.model}"? This will permanently delete this racket.`)) {
                                        declineMutation.mutate(racket.id);
                                      }
                                    }}
                                    disabled={declineMutation.isPending}
                                    title="Decline (delete)"
                                  >
                                    {declineMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => publishMutation.mutate(racket.id)}
                                    disabled={publishMutation.isPending}
                                    title="Approve & Publish"
                                  >
                                    {publishMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="cj-sync" className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">CJ Affiliate Feed Sync</h2>
                <p className="text-muted-foreground mt-1">
                  Sync product data from CJ affiliate feed to update prices and import new rackets
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Full Sync Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Full Sync
                    </CardTitle>
                    <CardDescription>
                      Downloads feed from CJ SFTP, updates prices, and imports new rackets with AI-generated ratings and reviews
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Updates prices for existing rackets</li>
                      <li>• Imports new rackets (pending review)</li>
                      <li>• Generates AI ratings for new rackets</li>
                      <li>• Creates AI reviews for new rackets</li>
                    </ul>
                    <Button
                      onClick={() => cjSyncMutation.mutate(false)}
                      disabled={cjSyncMutation.isPending}
                      className="w-full"
                    >
                      {cjSyncMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Run Full Sync
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Quick Sync Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5" />
                      Quick Price Update
                    </CardTitle>
                    <CardDescription>
                      Fast sync that only updates prices without AI generation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Updates prices for existing rackets</li>
                      <li>• Skips new racket imports</li>
                      <li>• No AI processing (faster)</li>
                      <li>• Ideal for daily price updates</li>
                    </ul>
                    <Button
                      variant="outline"
                      onClick={() => cjSyncMutation.mutate(true)}
                      disabled={cjSyncMutation.isPending}
                      className="w-full"
                    >
                      {cjSyncMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Zap className="mr-2 h-4 w-4" />
                          Quick Price Update
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Local File Sync Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Local File Sync
                    </CardTitle>
                    <CardDescription>
                      Process a local CJ feed file (for testing or manual imports)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Uses local data file</li>
                      <li>• Same processing as full sync</li>
                      <li>• Good for testing without SFTP</li>
                    </ul>
                    <Button
                      variant="secondary"
                      onClick={() => cjLocalSyncMutation.mutate()}
                      disabled={cjLocalSyncMutation.isPending}
                      className="w-full"
                    >
                      {cjLocalSyncMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Sync from Local File
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Scheduled Sync
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      CJ feed sync is automatically scheduled to run daily via Render cron jobs.
                    </p>
                    <div className="p-3 bg-background rounded-lg border">
                      <h4 className="font-medium text-sm mb-2">Environment Variables:</h4>
                      <ul className="text-xs text-muted-foreground font-mono space-y-1">
                        <li>CJ_SFTP_HOST</li>
                        <li>CJ_SFTP_USERNAME</li>
                        <li>CJ_SFTP_PASSWORD</li>
                        <li>CJ_FEED_FILENAME</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="padel-market-sync" className="space-y-6">
              <div>
                <h2 className="text-2xl font-semibold">Padel Market Affiliate Feed Sync</h2>
                <p className="text-muted-foreground mt-1">
                  Sync product data from Padel Market Awin feed to add alternative affiliate links
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Full Sync Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <RefreshCw className="h-5 w-5" />
                      Sync Padel Market Feed
                    </CardTitle>
                    <CardDescription>
                      Downloads feed from Awin URL, matches products to existing rackets, and updates affiliate links
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Downloads gzipped CSV from Awin</li>
                      <li>• Matches products by brand, model, and year</li>
                      <li>• Updates Padel Market affiliate links</li>
                      <li>• Marks products as in/out of stock</li>
                    </ul>
                    <Button
                      onClick={() => padelMarketSyncMutation.mutate()}
                      disabled={padelMarketSyncMutation.isPending}
                      className="w-full"
                    >
                      {padelMarketSyncMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync Padel Market Feed
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Local File Sync Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5" />
                      Local File Sync
                    </CardTitle>
                    <CardDescription>
                      Process a local Padel Market feed file (for testing or manual imports)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Uses local gzipped or plain CSV file</li>
                      <li>• Same processing as full sync</li>
                      <li>• Good for testing without network</li>
                    </ul>
                    <Button
                      variant="outline"
                      onClick={() => padelMarketLocalSyncMutation.mutate()}
                      disabled={padelMarketLocalSyncMutation.isPending}
                      className="w-full"
                    >
                      {padelMarketLocalSyncMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Sync from Local File
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Info Card */}
                <Card className="bg-muted/50 md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Scheduled Sync
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Padel Market feed sync is automatically scheduled to run daily at 4pm GMT via Render cron jobs.
                    </p>
                    <div className="p-3 bg-background rounded-lg border">
                      <h4 className="font-medium text-sm mb-2">Environment Variables:</h4>
                      <ul className="text-xs text-muted-foreground font-mono space-y-1">
                        <li>PADEL_MARKET_FEED_URL (optional, has default)</li>
                        <li>DATABASE_URL</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="guides" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Guides</h2>
              </div>

              {guidesLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <GuideTable guides={guides} onEdit={handleEditGuide} />
              )}
            </TabsContent>

            <TabsContent value="brands" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Brands</h2>
              </div>

              {brandsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <BrandTable brands={brands} onEdit={handleEditBrand} />
              )}
            </TabsContent>

            <TabsContent value="blog" className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Blog Posts</h2>
              </div>

              {postsLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <BlogPostTable posts={posts} onEdit={handleEditPost} />
              )}
            </TabsContent>
          </Tabs>

          {/* Racket Form Dialog */}
          <RacketForm
            racket={editingRacket}
            open={formOpen}
            onOpenChange={setFormOpen}
            onSubmit={handleFormSubmit}
          />

          {/* Guide Form Dialog */}
          <GuideForm
            guide={editingGuide}
            open={guideFormOpen}
            onOpenChange={setGuideFormOpen}
            onSubmit={handleGuideSubmit}
          />

          {/* Brand Form Dialog */}
          <BrandForm
            brand={editingBrand}
            open={brandFormOpen}
            onOpenChange={setBrandFormOpen}
            onSubmit={handleBrandSubmit}
          />

          {/* Blog Post Form Dialog */}
          <BlogPostForm
            post={editingPost}
            open={postFormOpen}
            onOpenChange={setPostFormOpen}
            onSubmit={handlePostSubmit}
          />
        </div>
      </div>
    </>
  );
}
