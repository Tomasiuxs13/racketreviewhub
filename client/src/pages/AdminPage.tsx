import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { ExcelRacket } from "@shared/schema";

interface UploadResult {
  created: number;
  updated: number;
  errors: string[];
  preview: ExcelRacket[];
}

export default function AdminPage() {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return await apiRequest("POST", "/api/admin/upload-rackets", formData);
    },
    onSuccess: (data: UploadResult) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/rackets"] });
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading font-bold text-4xl md:text-5xl mb-3" data-testid="text-page-title">
            Admin Panel
          </h1>
          <p className="text-muted-foreground text-lg">
            Upload an Excel file to create new racket reviews or update existing prices
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8">
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
                accept=".xlsx,.xls,.numbers"
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
                  <strong>Note:</strong> For best compatibility, export Numbers files as Excel format (File → Export To → Excel in Numbers app)
                </p>
                <p className="text-sm text-muted-foreground mb-2 mt-4">
                  Your file should contain these columns:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>brand, model, year, shape (diamond/round/teardrop)</li>
                  <li>powerRating, controlRating, reboundRating, maneuverabilityRating, sweetSpotRating (0-100)</li>
                  <li>currentPrice (required), originalPrice (optional)</li>
                  <li>imageUrl, affiliateLink, reviewContent (all optional)</li>
                </ul>
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Upload Results */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Upload Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
      </div>
    </div>
  );
}
