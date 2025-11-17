import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Plus, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ExcelRacket, InsertRacket, Racket } from "@shared/schema";
import { RacketForm } from "@/components/admin/RacketForm";
import { RacketTable } from "@/components/admin/RacketTable";

interface UploadResult {
  created: number;
  updated: number;
  errors: string[];
  preview: ExcelRacket[];
  totalRows?: number;
  processedRows?: number;
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
  const [formOpen, setFormOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch rackets for the table
  const { data: rackets = [], isLoading: racketsLoading } = useQuery<Racket[]>({
    queryKey: ["/api/admin/rackets"],
  });

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
          <TabsList>
            <TabsTrigger value="manage">Manage Rackets</TabsTrigger>
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
                    <p className="text-sm text-primary/80 mb-2 mt-4 font-medium">
                      ✨ Automatic Rating Estimation: If your file doesn't include performance ratings, they will be automatically estimated based on brand reputation and industry standards.
                    </p>
                    <p className="text-sm text-muted-foreground mb-2 mt-4">
                      Your file should contain these columns:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      <li><strong>Required:</strong> brand, model, shape (diamond/round/teardrop), currentPrice</li>
                      <li><strong>Auto-estimated if missing:</strong> powerRating, controlRating, reboundRating, maneuverabilityRating, sweetSpotRating (0-100)</li>
                      <li><strong>Optional:</strong> year, originalPrice, imageUrl, affiliateLink, reviewContent</li>
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
        </Tabs>

        {/* Racket Form Dialog */}
        <RacketForm
          racket={editingRacket}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSubmit={handleFormSubmit}
        />
      </div>
    </div>
  );
}
