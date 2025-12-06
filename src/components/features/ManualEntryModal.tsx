import { useState } from "react";
import { X, Plus, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ManualEntryModalProps {
  transactionId: string;
  onClose: () => void;
  onComplete: (transactionId: string, items: ReceiptItem[]) => void;
  initialItems?: ReceiptItem[];
}

interface ReceiptItem {
  name: string;
  price: number;
  category: string;
}

const CATEGORIES = ["Food", "Shopping", "Transport", "Entertainment", "Bills", "Others"];

const ManualEntryModal = ({ transactionId, onClose, onComplete, initialItems }: ManualEntryModalProps) => {
  const [items, setItems] = useState<ReceiptItem[]>(
    initialItems && initialItems.length > 0 
      ? initialItems 
      : [{ name: "", price: 0, category: "Others" }]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const addItem = () => {
    setItems([...items, { name: "", price: 0, category: "Others" }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof ReceiptItem, value: string | number) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handleSubmit = async () => {
    // Validate items
    const validItems = items.filter(item => item.name.trim() && item.price > 0);
    
    if (validItems.length === 0) {
      alert("Please add at least one item with a name and price.");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setIsSubmitting(false);
    setIsComplete(true);
    
    // Auto close after success
    setTimeout(() => {
      onComplete(transactionId, validItems);
      onClose();
    }, 1500);
  };

  const total = items.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-card rounded-2xl shadow-elevated p-6 animate-scale-in max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        {isComplete ? (
          <div className="flex flex-col items-center text-center py-8">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4 animate-pulse-success">
              <CheckCircle className="w-10 h-10 text-success" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Items Saved!</h2>
            <p className="text-muted-foreground">Your spending items have been recorded.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {initialItems && initialItems.length > 0 ? "Edit Items" : "Manual Entry"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {initialItems && initialItems.length > 0 
                  ? "Edit the items you purchased with their prices and categories."
                  : "Enter the items you purchased with their prices and categories."}
              </p>
            </div>

            {/* Items List */}
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="p-4 bg-muted/30 rounded-xl border border-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground">Item {index + 1}</h3>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(index)}
                        className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Item Name */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Item Name</label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      placeholder="e.g., Grande Latte"
                      className="w-full"
                    />
                  </div>

                  {/* Price and Category Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Price (RM)</label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price || ""}
                        onChange={(e) => updateItem(index, "price", parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                      <Select
                        value={item.category}
                        onValueChange={(value) => updateItem(index, "category", value)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Item Button */}
            <Button
              onClick={addItem}
              variant="outline"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Item
            </Button>

            {/* Total */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">
                  RM {total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              variant="primary"
              size="lg"
              onClick={handleSubmit}
              disabled={isSubmitting || items.every(item => !item.name.trim() || item.price <= 0)}
              className="w-full"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                "Save Items"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualEntryModal;

