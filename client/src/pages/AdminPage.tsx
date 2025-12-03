import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Plus, X, RefreshCw, Clock, Eye, EyeOff, Zap, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ExcelRacket, InsertRacket, Racket, Guide, Brand, BlogPost, InsertGuide, InsertBrand, InsertBlogPost } from "@shared/schema";
import { RacketForm } from "@/components/admin/RacketForm";
import { RacketTable } from "@/components/admin/RacketTable";
import { GuideForm } from "@/components/admin/GuideForm";
import { GuideTable } from "@/components/admin/GuideTable";
import { BrandForm } from "@/components/admin/BrandForm";
import { BrandTable } from "@/components/admin/BrandTable";
import { BlogPostForm } from "@/components/admin/BlogPostForm";
import { BlogPostTable } from "@/components/admin/BlogPostTable";
import { Checkbox } from "@/components/ui/checkbox";

interface UploadResult {
  created: number;
  updated: number;
  errors: string[];
  preview: ExcelRacket[];
  totalRows?: number;
  processedRows?: number;
}

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

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  // Restore upload results from localStorage on mount
  const [result, setResult] = useState<UploadResult | null>(() => {
    try {
      const savedResult = localStorage.getItem("lastUploadResult");
      if (savedResult) {
        const parsed = JSON.parse(savedResult);
        // Only restore if it's less than 1 hour old
        if (parsed.timestamp && Date.now() - parsed.timestamp < 60 * 60 * 1000) {
          console.log("Restored from localStorage:", parsed.data);
          return parsed.data;
        } else {
          localStorage.removeItem("lastUploadResult");
        }
      }
    } catch (e) {
      console.error("Error restoring from localStorage:", e);
      localStorage.removeItem("lastUploadResult");
    }
    return null;
  });
  const [editingRacket, setEditingRacket] = useState<Racket | undefined>(undefined);
  const [editingGuide, setEditingGuide] = useState<Guide | undefined>(undefined);
  const [editingBrand, setEditingBrand] = useState<Brand | undefined>(undefined);
  const [editingPost, setEditingPost] = useState<BlogPost | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [guideFormOpen, setGuideFormOpen] = useState(false);
  const [brandFormOpen, setBrandFormOpen] = useState(false);
  const [postFormOpen, setPostFormOpen] = useState(false);
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

  // Selected pending rackets for bulk actions
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Save upload start time to localStorage
      const uploadStart = {
        fileName: file.name,
        fileSize: file.size,
        startTime: Date.now(),
      };
      localStorage.setItem("activeUpload", JSON.stringify(uploadStart));
      
      try {
        const formData = new FormData();
        formData.append("file", file);
        const response = await apiRequest("POST", "/api/admin/upload-rackets", formData);
        return await response.json();
      } finally {
        // Clear upload tracking when done (success or error)
        localStorage.removeItem("activeUpload");
      }
    },
    onSuccess: (data: UploadResult) => {
      console.log("Upload success, data:", data);
      setResult(data);
      // Save upload results to localStorage
      localStorage.setItem("lastUploadResult", JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
      console.log("Saved to localStorage, totalRows:", data.totalRows, "processedRows:", data.processedRows);
      queryClient.invalidateQueries({
        predicate: (query) => {
          const keyString = JSON.stringify(query.queryKey);
          return keyString.includes("/api/rackets") || keyString.includes("/api/brands");
        },
      });
      toast({
        title: "Upload successful",
        description: `Created ${data.created} rackets, updated ${data.updated} rackets`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Check for interrupted uploads and restored results on mount
  useEffect(() => {
    const activeUpload = localStorage.getItem("activeUpload");
    if (activeUpload) {
      try {
        const upload = JSON.parse(activeUpload);
        const timeSinceStart = Date.now() - upload.startTime;
        // If upload started less than 5 minutes ago, it might still be processing
        if (timeSinceStart < 5 * 60 * 1000) {
          toast({
            title: "Upload may be in progress",
            description: `An upload of "${upload.fileName}" was started ${Math.round(timeSinceStart / 1000)}s ago. If you reloaded the page, the upload may still be processing on the server. Check the server logs or wait a moment.`,
            variant: "default",
          });
        } else {
          // Old upload, clear it
          localStorage.removeItem("activeUpload");
        }
      } catch (e) {
        localStorage.removeItem("activeUpload");
      }
    }
    
    // Notify if results were restored (only on mount)
    const savedResult = localStorage.getItem("lastUploadResult");
    if (savedResult && result) {
      try {
        const parsed = JSON.parse(savedResult);
        if (parsed.timestamp) {
          const timeSinceUpload = Date.now() - parsed.timestamp;
          const minutesAgo = Math.round(timeSinceUpload / 60000);
          if (minutesAgo < 60) {
            toast({
              title: "Upload results restored",
              description: `Showing results from ${minutesAgo === 0 ? 'just now' : `${minutesAgo} minute${minutesAgo > 1 ? 's' : ''} ago`}. Created ${result.created}, updated ${result.updated} rackets${result.processedRows !== undefined ? `, processed ${result.processedRows} rows` : ''}.`,
              variant: "default",
            });
          }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const fileName = droppedFile.name.toLowerCase();
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls") || fileName.endsWith(".numbers")) {
        setFile(droppedFile);
        setResult(null);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please upload an Excel (.xlsx, .xls) or Numbers (.numbers) file",
          variant: "destructive",
        });
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = () => {
    if (file) {
      uploadMutation.mutate(file);
    }
  };

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
    },
    onError: (error: Error) => {
      toast({
        title: "Local sync failed",
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

        <Tabs defaultValue="manage" className="space-y-6">
          <TabsList className="flex-wrap">
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
            <TabsTrigger value="guides">Guides</TabsTrigger>
            <TabsTrigger value="brands">Brands</TabsTrigger>
            <TabsTrigger value="blog">Blog Posts</TabsTrigger>
            <TabsTrigger value="upload">Upload Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="manage" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Rackets</h2>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Racket
              </Button>
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
              <RacketTable rackets={rackets} onEdit={handleEdit} />
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

          <TabsContent value="upload" className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Rackets Excel File</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Drag & Drop Zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  data-testid="dropzone-upload"
                >
                  <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold text-lg mb-2">
                    {file ? file.name : "Drop your Excel file here"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    or click to browse
                  </p>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.numbers,application/vnd.apple.numbers,application/x-iwork-numbers-sffnumbers"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                    data-testid="input-file-upload"
                  />
                  <label htmlFor="file-upload" data-testid="label-choose-file">
                    <Button variant="outline" asChild>
                      <span data-testid="button-choose-file">
                        <Upload className="mr-2 h-4 w-4" />
                        Choose File
                      </span>
                    </Button>
                  </label>
                </div>

                {/* File Info & Upload Button */}
                {file && (
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-primary" />
                      <div>
                        <p className="font-medium" data-testid="text-filename">{file.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleUpload}
                      disabled={uploadMutation.isPending}
                      data-testid="button-upload"
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="mr-2 h-4 w-4" />
                          Upload & Process
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Expected Format Info */}
                <Card className="bg-muted/50">
                  <CardContent className="p-6">
                    <h4 className="font-semibold mb-3">Supported Formats & Required Columns:</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      <strong>File Types:</strong> Excel (.xlsx, .xls) or Apple Numbers (.numbers)
                    </p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Note:</strong> Numbers files work best when uploaded via drag-and-drop. If you experience issues, export to Excel format (File → Export To → Excel in Numbers app).
                    </p>
                    
                    {/* Price Update Only Mode */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mt-4 mb-4">
                      <h5 className="font-medium text-blue-600 dark:text-blue-400 mb-2">💰 Price Update Only Mode</h5>
                      <p className="text-sm text-muted-foreground mb-2">
                        To update prices for existing rackets without brand/model/shape columns:
                      </p>
                      <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                        <li><strong>Required:</strong> Title_URL (product URL), current_price</li>
                        <li><strong>Optional:</strong> original_price, Image, affiliateLink</li>
                      </ul>
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        The system will match rackets by Title_URL and update only the prices.
                      </p>
                    </div>
                    
                    <p className="text-sm text-primary/80 mb-2 font-medium">
                      ✨ Automatic Rating Estimation: If your file doesn't include performance ratings, they will be automatically estimated based on brand reputation and industry standards.
                    </p>
                    <p className="text-sm text-muted-foreground mb-2 mt-4">
                      <strong>For creating new rackets,</strong> your file should contain these columns:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li><strong>Required:</strong> brand, model, shape (diamond/round/teardrop), currentPrice</li>
                      <li><strong>Auto-estimated if missing:</strong> powerRating, controlRating, reboundRating, maneuverabilityRating, sweetSpotRating (0-100)</li>
                      <li><strong>Optional:</strong> year, originalPrice, imageUrl, affiliateLink, reviewContent, Title_URL</li>
                    </ul>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>

            {/* Upload Results */}
            {result && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Upload Results
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setResult(null);
                        localStorage.removeItem("lastUploadResult");
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Row Count Summary - Always show if we have row data */}
                  {result && (result.totalRows !== undefined || result.processedRows !== undefined) && (
                    <div className="text-center p-4 bg-muted/50 rounded-lg border">
                      <p className="text-sm text-muted-foreground">
                        Processed <span className="font-semibold text-foreground">{result.processedRows ?? result.totalRows ?? 'N/A'}</span> of <span className="font-semibold text-foreground">{result.totalRows ?? 'N/A'}</span> rows
                        {result.totalRows !== undefined && result.processedRows !== undefined && result.totalRows > result.processedRows && (
                          <span className="text-muted-foreground ml-2">
                            ({result.totalRows - result.processedRows} empty rows skipped)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  
                  {/* Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="bg-primary/5 border-primary/20">
                      <CardContent className="p-6 text-center">
                        <p className="text-3xl font-bold text-primary" data-testid="text-created-count">
                          {result.created}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">New Rackets Created</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-chart-2/5 border-chart-2/20">
                      <CardContent className="p-6 text-center">
                        <p className="text-3xl font-bold text-chart-2" data-testid="text-updated-count">
                          {result.updated}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Existing Rackets Updated</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-destructive/5 border-destructive/20">
                      <CardContent className="p-6 text-center">
                        <p className="text-3xl font-bold text-destructive" data-testid="text-errors-count">
                          {result.errors.length}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">Errors</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Errors */}
                  {result.errors.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Errors:
                      </h4>
                      <ul className="space-y-2">
                        {result.errors.map((error, i) => (
                          <li key={i} className="text-sm text-destructive bg-destructive/5 p-3 rounded-md">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
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
  );
}
