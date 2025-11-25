import AdmZip from "adm-zip";
import * as plist from "plist";

interface NumbersCell {
  value?: string | number;
  text?: string;
}

export async function parseNumbersFile(buffer: Buffer): Promise<any[]> {
  try {
    // .numbers files are ZIP archives
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    // Find Index.zip inside the .numbers file
    const indexEntry = zipEntries.find(entry => entry.entryName === "Index.zip");
    if (!indexEntry) {
      throw new Error("Invalid .numbers file: Index.zip not found");
    }

    // Extract and parse Index.zip
    const indexZip = new AdmZip(indexEntry.getData());
    const indexEntries = indexZip.getEntries();

    // Look for the main data file (usually Index/Document.iwa or similar)
    // For simplicity, we'll try to find any .iwa files or parseable content
    let data: any[] = [];

    // Try to find Index/Metadata/DocumentMetadata.iwa or similar
    const metadataEntry = indexEntries.find(entry => 
      entry.entryName.includes("Metadata") || entry.entryName.includes("Document")
    );

    // For a more robust solution, we need to parse the IWA (iWork Archive) format
    // which is protobuf-based. For now, let's try a simpler approach:
    // Look for any XML or plist files that might contain the table data
    
    const plistEntry = indexEntries.find(entry => 
      entry.entryName.endsWith(".plist") || entry.entryName.includes("Metadata")
    );

    if (plistEntry) {
      try {
        const plistContent = plistEntry.getData().toString('utf8');
        const parsed = plist.parse(plistContent);
        // Extract data from plist if possible
        console.log("Found plist data:", parsed);
      } catch (err) {
        console.error("Error parsing plist:", err);
      }
    }

    // Since .numbers uses a complex protobuf format (IWA), 
    // we'll need to implement a basic parser or use a workaround
    // For now, let's return an error asking for Excel format
    throw new Error(
      "Apple Numbers format parsing is complex. Please export your file as Excel (.xlsx) format: " +
      "File → Export To → Excel in Numbers app, then upload the .xlsx file."
    );

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to parse .numbers file");
  }
}
