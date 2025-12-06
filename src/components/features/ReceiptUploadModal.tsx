import { useState, useRef } from "react";
import { X, Upload, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReceiptUploadModalProps {
  transactionId: string;
  onClose: () => void;
  onComplete: (transactionId: string, items: ReceiptItem[]) => void;
}

interface ReceiptItem {
  name: string;
  price: number;
  category: string;
}

const CATEGORIES = ["Food", "Shopping", "Transport", "Entertainment", "Bills", "Others"];

// Category keywords for automatic categorization
const categoryKeywords: Record<string, string[]> = {
  Food: ["food", "restaurant", "cafe", "coffee", "tea", "burger", "pizza", "chicken", "rice", "noodle", "drink", "beverage", "snack", "meal", "dining", "starbucks", "mcdonald", "kfc"],
  Shopping: ["clothing", "shirt", "pants", "shoes", "bag", "accessory", "store", "retail", "purchase", "item", "product", "uniqlo", "lazada", "shopee"],
  Transport: ["taxi", "grab", "uber", "bus", "train", "fuel", "gas", "petrol", "parking", "toll", "transport", "ride"],
  Entertainment: ["movie", "cinema", "netflix", "spotify", "game", "entertainment", "streaming", "subscription"],
  Bills: ["bill", "utility", "electric", "water", "internet", "phone", "subscription", "tenaga", "tnb", "celcom", "maxis"],
};

// Mock OCR function - In production, use Tesseract.js or a cloud OCR service
const extractTextFromImage = async (imageFile: File): Promise<string> => {
  // Simulate OCR processing
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Mock receipt text - In production, this would be actual OCR result
  // For demo purposes, return a sample receipt format
  return `STARBUCKS COFFEE
123 MAIN STREET
Date: 06/12/2024 10:30 AM

Grande Latte         RM 12.90
Blueberry Muffin     RM  6.00
--------------------------------
Subtotal            RM 18.90
Tax                  RM  0.00
--------------------------------
TOTAL               RM 18.90

Thank you for visiting!`;
};

// Parse receipt text to extract items and prices
const parseReceiptText = (text: string): ReceiptItem[] => {
  const items: ReceiptItem[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  // Pattern to match item name and price (e.g., "Item Name    RM 12.90")
  const pricePattern = /RM\s*(\d+\.?\d*)/i;
  const totalPattern = /TOTAL|SUBTOTAL|TAX|BALANCE/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header, footer, and total lines
    if (totalPattern.test(line) || 
        line.includes('Thank you') || 
        line.includes('Date:') ||
        line.includes('---') ||
        line.length < 3) {
      continue;
    }
    
    // Check if line contains a price
    const priceMatch = line.match(pricePattern);
    if (priceMatch) {
      const price = parseFloat(priceMatch[1]);
      
      // Extract item name (everything before the price)
      const itemName = line.replace(pricePattern, '').trim();
      
      if (itemName && price > 0 && price < 10000) { // Reasonable price range
        // Categorize the item
        const category = categorizeItem(itemName);
        
        items.push({
          name: itemName,
          price: price,
          category: category,
        });
      }
    }
  }
  
  // If no items found, try alternative parsing
  if (items.length === 0) {
    // Try to find lines with numbers that might be prices
    for (const line of lines) {
      const numbers = line.match(/\d+\.\d{2}/g);
      if (numbers && numbers.length > 0) {
        const price = parseFloat(numbers[numbers.length - 1]);
        if (price > 0 && price < 10000) {
          const itemName = line.replace(/\d+\.\d{2}/g, '').replace(/RM/gi, '').trim();
          if (itemName.length > 2) {
            items.push({
              name: itemName || "Item",
              price: price,
              category: categorizeItem(itemName),
            });
          }
        }
      }
    }
  }
  
  return items;
};

// Categorize item based on name
const categorizeItem = (itemName: string): string => {
  const lowerName = itemName.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(keyword => lowerName.includes(keyword))) {
      return category;
    }
  }
  
  return "Others";
};

const ReceiptUploadModal = ({ transactionId, onClose, onComplete }: ReceiptUploadModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [extractedItems, setExtractedItems] = useState<ReceiptItem[]>([]);
  const [extractedText, setExtractedText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Process the image
    await processImage(file);
  };

  const processImage = async (imageFile: File) => {
    setIsProcessing(true);
    setExtractedItems([]);
    setExtractedText("");

    try {
      // Extract text using OCR
      const text = await extractTextFromImage(imageFile);
      setExtractedText(text);

      // Parse text to extract items
      const items = parseReceiptText(text);
      setExtractedItems(items);
    } catch (error) {
      console.error('Error processing image:', error);
      alert('Failed to process receipt. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = () => {
    if (extractedItems.length > 0) {
      onComplete(transactionId, extractedItems);
      setIsComplete(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      alert('No items found in receipt. Please try again with a clearer image.');
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-2xl bg-card rounded-2xl shadow-elevated p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        {isComplete ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4 animate-pulse-success">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Receipt Analyzed!</h2>
            <p className="text-muted-foreground">
              {extractedItems.length} item(s) extracted and categorized.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Upload Receipt</h2>
              <p className="text-muted-foreground text-sm">
                Upload a receipt image to automatically extract items and categorize them.
              </p>
            </div>

            {/* Preview */}
            {preview && (
              <div className="relative">
                <img
                  src={preview}
                  alt="Receipt preview"
                  className="w-full rounded-xl border border-border"
                />
                <button
                  onClick={() => {
                    setPreview(null);
                    setExtractedItems([]);
                    setExtractedText("");
                  }}
                  className="absolute top-2 right-2 p-2 bg-card/80 rounded-full hover:bg-card"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Option */}
            {!preview && (
              <div className="space-y-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="h-24 flex-col gap-2"
                >
                  <Upload className="w-6 h-6" />
                  <span>Upload</span>
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                  }}
                />
              </div>
            )}

            {/* Processing State */}
            {isProcessing && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Extracting text from receipt...</p>
              </div>
            )}

            {/* Extracted Items */}
            {extractedItems.length > 0 && !isProcessing && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Extracted Items</h3>
                  <div className="space-y-2">
                    {extractedItems.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            item.category === "Food" && "bg-accent/10 text-accent",
                            item.category === "Shopping" && "bg-primary/10 text-primary",
                            item.category === "Transport" && "bg-secondary/10 text-secondary-foreground",
                            item.category === "Entertainment" && "bg-destructive/10 text-destructive",
                            item.category === "Bills" && "bg-muted text-muted-foreground",
                            item.category === "Others" && "bg-muted text-muted-foreground",
                          )}>
                            {item.category}
                          </span>
                        </div>
                        <p className="font-semibold text-foreground ml-4">
                          RM {item.price.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">Total</span>
                      <span className="text-xl font-bold text-foreground">
                        RM {extractedItems.reduce((sum, item) => sum + item.price, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleComplete}
                    variant="primary"
                    className="flex-1"
                  >
                    Confirm & Save
                  </Button>
                  <Button
                    onClick={() => {
                      setPreview(null);
                      setExtractedItems([]);
                      setExtractedText("");
                    }}
                    variant="outline"
                  >
                    Retake
                  </Button>
                </div>
              </div>
            )}

            {/* Extracted Text (for debugging) */}
            {extractedText && !isProcessing && extractedItems.length === 0 && (
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-2">Extracted Text:</p>
                <pre className="text-xs text-foreground whitespace-pre-wrap">{extractedText}</pre>
                <p className="text-xs text-muted-foreground mt-2">
                  No items could be extracted. Please try with a clearer image.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptUploadModal;
