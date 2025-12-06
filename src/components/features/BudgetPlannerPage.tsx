import { useState, useRef, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { ArrowLeft, Target, Plus, Trash2, TrendingDown, Sparkles, PiggyBank, AlertCircle, Calendar, DollarSign, Wallet, Brain, Lightbulb, TrendingUp, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface BudgetPlannerPageProps {
  onBack: () => void;
}

interface BudgetSetup {
  income: number;
  savingsGoal: number;
  years: number;
  months: number;
}

interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  icon: string;
  isRecommended?: boolean;
  flexibility?: "high" | "medium" | "low";
  recommendation?: string;
}

interface SpendingPattern {
  category: string;
  averageSpending: number;
  frequency: number;
  isEssential: boolean;
  isEnjoyment: boolean;
  percentage: number;
}

interface AIRecommendation {
  category: string;
  suggestedBudget: number;
  reason: string;
  flexibility: "high" | "medium" | "low";
  tips: string[];
}

// Scrolling Picker Component
const ScrollingPicker = ({ 
  values, 
  selectedIndex, 
  onSelect, 
  label 
}: { 
  values: number[]; 
  selectedIndex: number; 
  onSelect: (index: number) => void;
  label: string;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const itemHeight = 50;
  const visibleItems = 3;
  const containerHeight = itemHeight * visibleItems;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = selectedIndex * itemHeight;
    }
  }, [selectedIndex, itemHeight]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
    onSelect(clampedIndex);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const deltaY = e.clientY - startY;
    scrollRef.current.scrollTop = scrollTop - deltaY;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    snapToNearest();
  };

  const snapToNearest = () => {
    if (!scrollRef.current) return;
    const scrollTop = scrollRef.current.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, values.length - 1));
    scrollRef.current.scrollTo({
      top: clampedIndex * itemHeight,
      behavior: 'smooth'
    });
    onSelect(clampedIndex);
  };

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const deltaY = e.touches[0].clientY - startY;
    scrollRef.current.scrollTop = scrollTop - deltaY;
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    snapToNearest();
  };

  return (
    <div className="flex-1">
      <p className="text-xs text-muted-foreground mb-2 text-center">{label}</p>
      <div className="relative h-[150px] overflow-hidden">
        {/* Selection Indicator */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[50px] border-y-2 border-primary/30 pointer-events-none z-10" />
        
        {/* Scrollable List */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
          style={{
            scrollSnapType: 'y mandatory',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Top Spacer */}
          <div style={{ height: `${itemHeight}px` }} />
          
          {/* Items */}
          {values.map((value, index) => (
            <div
              key={index}
              className={cn(
                "h-[50px] flex items-center justify-center text-lg font-medium transition-colors snap-center",
                index === selectedIndex
                  ? "text-foreground scale-110"
                  : "text-muted-foreground"
              )}
              style={{ height: `${itemHeight}px` }}
            >
              {value}
            </div>
          ))}
          
          {/* Bottom Spacer */}
          <div style={{ height: `${itemHeight}px` }} />
        </div>
      </div>
    </div>
  );
};

const BudgetPlannerPage = ({ onBack }: BudgetPlannerPageProps) => {
  const { toast } = useToast();
  
  // Fetch transactions from Convex
  const convexTransactions = useQuery(api.transactions.list);
  
  // Fetch real-time current month spending
  const currentMonthSpending = useQuery(api.budget.getCurrentMonthSpending) || {};
  
  // AI Budget generation action
  const generateAIBudget = useAction(api.budget.generateBudgetRecommendations);
  
  const [setupComplete, setSetupComplete] = useState(false);
  const [setup, setSetup] = useState<BudgetSetup>({
    income: 0,
    savingsGoal: 0,
    years: 0,
    months: 1,
  });
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoal, setSavingsGoal] = useState(500);
  const [currentSavings, setCurrentSavings] = useState(310);
  const [showAddBudget, setShowAddBudget] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newLimit, setNewLimit] = useState("");
  const [aiInsights, setAiInsights] = useState<string[]>([]);
  const [isGeneratingBudget, setIsGeneratingBudget] = useState(false);

  // Generate arrays for picker
  const years = Array.from({ length: 11 }, (_, i) => i); // 0-10 years
  const months = Array.from({ length: 12 }, (_, i) => i); // 0-11 months
  
  // Handle months selection based on years
  // If years = 0, minimum months = 1; if years > 0, months can be 0
  const handleYearsChange = (yearIndex: number) => {
    const newYears = yearIndex;
    let newMonths = setup.months;
    
    if (newYears === 0 && newMonths === 0) {
      // If switching to 0 years, ensure months is at least 1
      newMonths = 1;
    }
    
    setSetup({ ...setup, years: newYears, months: newMonths });
  };
  
  const handleMonthsChange = (monthIndex: number) => {
    const newMonths = monthIndex;
    
    // If years = 0, don't allow months = 0
    if (setup.years === 0 && newMonths === 0) {
      return; // Prevent selecting 0 months when years is 0
    }
    
    setSetup({ ...setup, months: newMonths });
  };

  // Analyze spending patterns from transactions
  const analyzeSpendingPatterns = (): SpendingPattern[] => {
    if (!convexTransactions || convexTransactions.length === 0) return [];
    
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const recentTransactions = convexTransactions.filter(
      (t) => t.timestamp >= thirtyDaysAgo && t.amount < 0
    );
    
    if (recentTransactions.length === 0) return [];
    
    const totalSpending = recentTransactions.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    );
    
    const categoryMap: Record<string, { amount: number; count: number }> = {};
    recentTransactions.forEach((t) => {
      const cat = t.category || "Others";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { amount: 0, count: 0 };
      }
      categoryMap[cat].amount += Math.abs(t.amount);
      categoryMap[cat].count += 1;
    });
    
    const essentialCategories = ["Bills", "Transport", "Food"];
    const enjoymentCategories = ["Entertainment", "Shopping"];
    
    return Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        averageSpending: data.amount,
        frequency: data.count,
        isEssential: essentialCategories.includes(category),
        isEnjoyment: enjoymentCategories.includes(category),
        percentage: (data.amount / totalSpending) * 100,
      }))
      .sort((a, b) => b.averageSpending - a.averageSpending);
  };

  // AI-powered budget recommendations
  const generateAIRecommendations = (): AIRecommendation[] => {
    const patterns = analyzeSpendingPatterns();
    if (patterns.length === 0 || !setup.income || !setup.savingsGoal) return [];
    
    const monthlySavingsNeeded = getMonthlySavingsNeeded();
    const availableForSpending = setup.income - monthlySavingsNeeded;
    
    // Calculate total current spending
    const totalCurrentSpending = patterns.reduce(
      (sum, p) => sum + p.averageSpending,
      0
    );
    
    // Smart allocation: Allow 80-120% of current spending for enjoyment categories
    // But be stricter on essential categories (90-110%)
    const recommendations: AIRecommendation[] = patterns.map((pattern) => {
      const currentSpending = pattern.averageSpending;
      let suggestedBudget: number;
      let flexibility: "high" | "medium" | "low";
      let reason: string;
      const tips: string[] = [];
      
      if (pattern.isEssential) {
        // Essential: Allow slight increase but keep it reasonable
        suggestedBudget = currentSpending * 1.05; // 5% buffer
        flexibility = "low";
        reason = `Essential category - keeping it close to your current spending with a small buffer for unexpected needs.`;
        tips.push("Track bills closely to avoid surprises");
        tips.push("Consider setting up auto-payments for consistency");
      } else if (pattern.isEnjoyment) {
        // Enjoyment: Allow more flexibility but still guide toward goal
        const flexibilityFactor = availableForSpending > totalCurrentSpending ? 1.15 : 1.0;
        suggestedBudget = currentSpending * flexibilityFactor;
        flexibility = "high";
        reason = `You enjoy spending here! We're giving you room to enjoy while staying on track.`;
        tips.push("Treat yourself, but set a weekly limit");
        tips.push("Look for deals and discounts to stretch your budget");
      } else {
        // Other categories: Moderate flexibility
        suggestedBudget = currentSpending * 1.1;
        flexibility = "medium";
        reason = `Based on your spending patterns, this gives you flexibility while maintaining discipline.`;
        tips.push("Review monthly to adjust as needed");
      }
      
      return {
        category: pattern.category,
        suggestedBudget: Math.round(suggestedBudget),
        reason,
        flexibility,
        tips,
      };
    });
    
    // Normalize budgets to fit within available spending
    const totalSuggested = recommendations.reduce(
      (sum, r) => sum + r.suggestedBudget,
      0
    );
    
    if (totalSuggested > availableForSpending) {
      // Scale down proportionally
      const scaleFactor = availableForSpending / totalSuggested;
      recommendations.forEach((rec) => {
        rec.suggestedBudget = Math.round(rec.suggestedBudget * scaleFactor);
      });
    }
    
    return recommendations;
  };

  // Calculate monthly savings needed based on duration
  const getMonthlySavingsNeeded = () => {
    const totalMonths = setup.years * 12 + setup.months;
    if (totalMonths === 0) return 0;
    return setup.savingsGoal / totalMonths;
  };
  
  // Clear budgets when setup is incomplete (user clicked Edit)
  useEffect(() => {
    if (!setupComplete) {
      setBudgets([]);
      setAiInsights([]);
    }
  }, [setupComplete]);
  
  // Auto-generate budgets using AI when setup is complete
  useEffect(() => {
    if (setupComplete && convexTransactions && setup.income > 0 && setup.savingsGoal > 0 && budgets.length === 0) {
      const generateBudgets = async () => {
        setIsGeneratingBudget(true);
        try {
          const totalMonths = setup.years * 12 + setup.months;
          console.log("Generating budget with:", { 
            income: setup.income, 
            savingsGoal: setup.savingsGoal, 
            durationMonths: totalMonths 
          });
          
          const result = await generateAIBudget({
            income: setup.income,
            savingsGoal: setup.savingsGoal,
            durationMonths: totalMonths,
          });
          
          if (result.success && result.budgets) {
            const newBudgets: Budget[] = result.budgets.map((rec, index) => {
              return {
                id: Date.now().toString() + index,
                category: rec.category,
                limit: rec.suggestedBudget,
                spent: rec.currentSpending || 0, // Use REAL current month spending from AI
                icon: getCategoryIcon(rec.category),
                isRecommended: true,
                flexibility: rec.flexibility,
                recommendation: rec.reason,
              };
            });
            
            setBudgets(newBudgets);
            
            // Set AI insights
            if (result.insights && result.insights.length > 0) {
              setAiInsights(result.insights);
            } else {
              // Generate insights from AI recommendations
              generateInsightsFromAI(result);
            }
            
            toast({
              title: "AI Budget Generated",
              description: `Budget created for RM ${setup.income.toFixed(2)}/month income.`,
            });
          }
        } catch (error) {
          console.error("Error generating AI budget:", error);
          toast({
            title: "Budget Generation Failed",
            description: "Using intelligent fallback recommendations based on your spending.",
            variant: "destructive",
          });
          
          // Fallback to local recommendations
          const recommendations = generateAIRecommendations();
          const patterns = analyzeSpendingPatterns();
          
          if (recommendations.length > 0) {
            const newBudgets: Budget[] = recommendations.map((rec, index) => {
              const pattern = patterns.find((p) => p.category === rec.category);
              return {
                id: Date.now().toString() + index,
                category: rec.category,
                limit: rec.suggestedBudget,
                spent: pattern?.averageSpending || 0,
                icon: getCategoryIcon(rec.category),
                isRecommended: true,
                flexibility: rec.flexibility,
                recommendation: rec.reason,
              };
            });
            setBudgets(newBudgets);
          }
        } finally {
          setIsGeneratingBudget(false);
        }
      };
      
      generateBudgets();
    }
  }, [setupComplete, convexTransactions, setup.income, setup.savingsGoal, setup.years, setup.months]);
  
  const generateInsightsFromAI = (aiResult: any) => {
    const insights: string[] = [];
    const patterns = analyzeSpendingPatterns();
    
    if (patterns.length > 0 && aiResult.budgets) {
      const topCategory = patterns[0];
      const topBudget = aiResult.budgets.find((b: any) => b.category === topCategory.category);
      
      if (topBudget) {
        insights.push(
          `AI analyzed your spending and recommends RM ${topBudget.suggestedBudget.toFixed(2)}/month for ${topCategory.category}. This balances your enjoyment with your savings goal.`
        );
      }
      
      const enjoymentBudgets = aiResult.budgets.filter((b: any) => b.flexibility === "high");
      if (enjoymentBudgets.length > 0) {
        insights.push(
          `AI suggests flexible budgets for ${enjoymentBudgets.length} category${enjoymentBudgets.length > 1 ? "ies" : ""} you enjoy, allowing you to treat yourself while staying on track.`
        );
      }
      
      const monthlySavings = getMonthlySavingsNeeded();
      const totalRecommended = aiResult.budgets.reduce((sum: number, b: any) => sum + b.suggestedBudget, 0);
      const available = setup.income - monthlySavings;
      
      if (totalRecommended < available * 0.95) {
        insights.push(
          `Great news! Your AI-generated budgets leave RM ${(available - totalRecommended).toFixed(2)} extra each month for unexpected expenses or additional savings.`
        );
      }
    }
    
    setAiInsights(insights);
  };
  
  // Generate AI insights
  useEffect(() => {
    if (setupComplete && convexTransactions && budgets.length > 0) {
      const patterns = analyzeSpendingPatterns();
      const recommendations = generateAIRecommendations();
      const insights: string[] = [];
      
      if (patterns.length > 0) {
        const topCategory = patterns[0];
        const monthlySavings = getMonthlySavingsNeeded();
        const available = setup.income - monthlySavings;
        
        insights.push(
          `Your top spending category is ${topCategory.category} (RM ${topCategory.averageSpending.toFixed(2)}/month). We've allocated a flexible budget that lets you enjoy it while staying on track.`
        );
        
        if (topCategory.isEnjoyment) {
          insights.push(
            `Since you enjoy ${topCategory.category}, we've given you a 15% buffer to treat yourself without guilt. Life's about balance!`
          );
        }
        
        const totalRecommended = recommendations.reduce(
          (sum, r) => sum + r.suggestedBudget,
          0
        );
        
        if (totalRecommended < available * 0.9) {
          insights.push(
            `Great news! Your recommended budgets leave you with RM ${(available - totalRecommended).toFixed(2)} extra each month for unexpected expenses or extra savings.`
          );
        }
        
        const enjoymentTotal = patterns
          .filter((p) => p.isEnjoyment)
          .reduce((sum, p) => sum + p.averageSpending, 0);
        
        if (enjoymentTotal > available * 0.4) {
          insights.push(
            `You spend ${((enjoymentTotal / available) * 100).toFixed(0)}% on things you enjoy - that's healthy! We're keeping that balance.`
          );
        }
      }
      
      setAiInsights(insights);
    }
  }, [setupComplete, convexTransactions, budgets.length, setup.income, setup.savingsGoal]);

  const getDurationDisplay = () => {
    const parts: string[] = [];
    if (setup.years > 0) {
      parts.push(`${setup.years} year${setup.years !== 1 ? "s" : ""}`);
    }
    if (setup.months > 0) {
      parts.push(`${setup.months} month${setup.months !== 1 ? "s" : ""}`);
    }
    // If years > 0 and months = 0, just show years
    if (parts.length === 0) {
      return "1 month"; // Fallback
    }
    return parts.join(", ");
  };

  const availableForBudget = setup.income - getMonthlySavingsNeeded();

  const handleSetupSubmit = () => {
    // Validate: if years = 0, months must be >= 1; if years > 0, months can be 0
    const totalMonths = setup.years * 12 + setup.months;
    if (!setup.income || !setup.savingsGoal || totalMonths === 0) {
      alert("Please fill in all fields and select a valid duration.");
      return;
    }
    if (setup.years === 0 && setup.months === 0) {
      alert("Please select at least 1 month when duration is less than 1 year.");
      return;
    }
    if (availableForBudget < 0) {
      alert("Your savings goal exceeds your income. Please adjust your goals.");
      return;
    }
    setSavingsGoal(setup.savingsGoal);
    setSetupComplete(true);
  };

  // Update budgets with real-time current month spending
  useEffect(() => {
    if (budgets.length > 0 && Object.keys(currentMonthSpending).length > 0) {
      setBudgets(prevBudgets => 
        prevBudgets.map(budget => ({
          ...budget,
          spent: currentMonthSpending[budget.category] || 0, // Use real current month spending
        }))
      );
    }
  }, [currentMonthSpending, budgets.length]);
  
  const totalBudget = budgets.reduce((acc, b) => acc + b.limit, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.spent, 0);
  const totalRemaining = totalBudget - totalSpent;

  const handleAddBudget = () => {
    if (!newCategory || !newLimit) return;
    const newBudget: Budget = {
      id: Date.now().toString(),
      category: newCategory,
      limit: parseFloat(newLimit),
      spent: 0,
      icon: "📊",
    };
    setBudgets([...budgets, newBudget]);
    setNewCategory("");
    setNewLimit("");
    setShowAddBudget(false);
  };

  const handleDeleteBudget = (id: string) => {
    setBudgets(budgets.filter((b) => b.id !== id));
  };
  
  const getCategoryIcon = (category: string): string => {
    const icons: Record<string, string> = {
      Food: "🍽️",
      Shopping: "🛍️",
      Transport: "🚗",
      Entertainment: "🎬",
      Bills: "💳",
      Others: "📊",
    };
    return icons[category] || "📊";
  };
  
  const getFlexibilityColor = (flexibility?: "high" | "medium" | "low") => {
    switch (flexibility) {
      case "high":
        return "bg-accent/10 text-accent border-accent/20";
      case "medium":
        return "bg-primary/10 text-primary border-primary/20";
      case "low":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="flex-1 px-4 py-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Budget Planner</h1>
          <p className="text-sm text-muted-foreground">Control spending, grow savings</p>
        </div>
      </div>

      {/* Setup Step */}
      {!setupComplete && (
        <div className="space-y-4 animate-slide-up">
          <div className="bg-card rounded-2xl shadow-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-foreground">Budget Setup</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Let's set up your budget by understanding your income and savings goals.
            </p>

            {/* Income Input */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Monthly Income (RM)
              </label>
              <Input
                type="number"
                placeholder="Enter your monthly income"
                value={setup.income || ""}
                onChange={(e) => setSetup({ ...setup, income: parseFloat(e.target.value) || 0 })}
                className="w-full"
              />
            </div>

            {/* Savings Goal Input */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <PiggyBank className="w-4 h-4" />
                Savings Goal (RM)
              </label>
              <Input
                type="number"
                placeholder="How much do you want to save?"
                value={setup.savingsGoal || ""}
                onChange={(e) => setSetup({ ...setup, savingsGoal: parseFloat(e.target.value) || 0 })}
                className="w-full"
              />
            </div>

            {/* Duration Selection - Scrolling Picker */}
            <div className="space-y-2 mb-6">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Duration for Saving
              </label>
              <div className="bg-card rounded-xl border border-border p-4">
                <div className="flex gap-4 items-end">
                  <ScrollingPicker
                    values={years}
                    selectedIndex={setup.years}
                    onSelect={handleYearsChange}
                    label="Years"
                  />
                  <ScrollingPicker
                    values={months}
                    selectedIndex={setup.months}
                    onSelect={handleMonthsChange} 
                    label="Months"
                  />
                </div>
                <div className="mt-4 pt-4 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground">Selected Duration</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {getDurationDisplay()}
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Preview */}
            {setup.income > 0 && setup.savingsGoal > 0 && (setup.years > 0 || setup.months > 0) && (
              <div className="mb-6 p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Budget Summary</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Income:</span>
                    <span className="font-semibold text-foreground">RM {setup.income.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monthly Savings Needed:</span>
                    <span className="font-semibold text-success">RM {getMonthlySavingsNeeded().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-border">
                    <span className="text-muted-foreground">Available for Budget:</span>
                    <span className="font-semibold text-foreground">RM {availableForBudget.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <Button
              variant="primary"
              onClick={handleSetupSubmit}
              className="w-full"
              disabled={!setup.income || !setup.savingsGoal || (setup.years === 0 && setup.months === 0)}
            >
              Start Planning
            </Button>
          </div>
        </div>
      )}

      {/* Budget Planner Content */}
      {setupComplete && (
        <>
          {isGeneratingBudget && (
            <div className="bg-card rounded-2xl shadow-card p-8 text-center animate-slide-up">
              <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
              <h3 className="text-lg font-semibold text-foreground mb-2">AI is analyzing your spending...</h3>
              <p className="text-sm text-muted-foreground">
                Generating personalized budget recommendations based on your transaction history and spending patterns.
              </p>
            </div>
          )}
          
          {!isGeneratingBudget && (
            <>
      {/* Savings Goal Card */}
      <div className="bg-gradient-to-br from-primary to-accent rounded-2xl shadow-elevated p-5 text-primary-foreground animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
            <PiggyBank className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm opacity-90">Savings Goal</p>
            <p className="text-2xl font-bold">RM {setup.savingsGoal.toFixed(2)}</p>
            <p className="text-xs opacity-80 mt-1">Target: {getDurationDisplay()}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSetupComplete(false)}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            Edit
          </Button>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="opacity-90">Progress</span>
            <span className="font-medium">RM {currentSavings.toFixed(2)} / RM {savingsGoal.toFixed(2)}</span>
          </div>
          <div className="h-3 bg-primary-foreground/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-foreground rounded-full transition-all duration-500"
              style={{ width: `${(currentSavings / savingsGoal) * 100}%` }}
            />
          </div>
          <p className="text-xs opacity-80 text-center mt-2">
            {Math.round((currentSavings / savingsGoal) * 100)}% achieved • RM {(savingsGoal - currentSavings).toFixed(2)} to go
          </p>
        </div>
      </div>

      {/* Budget Overview */}
      <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Budget Overview</h2>
          <div className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">RM {totalRemaining.toFixed(2)}</span> left
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-muted rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Monthly Income</p>
            <p className="text-lg font-bold text-foreground">RM {setup.income.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-success/10 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Monthly Savings</p>
            <p className="text-lg font-bold text-success">RM {getMonthlySavingsNeeded().toFixed(2)}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center pt-4 border-t border-border">
          <div className="p-3 bg-muted rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Total Budget</p>
            <p className="text-lg font-bold text-foreground">RM {totalBudget.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-destructive/10 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Spent</p>
            <p className="text-lg font-bold text-destructive">RM {totalSpent.toFixed(2)}</p>
          </div>
          <div className="p-3 bg-success/10 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Remaining</p>
            <p className="text-lg font-bold text-success">RM {totalRemaining.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Category Budgets */}
      <div className="space-y-3 animate-slide-up" style={{ animationDelay: "100ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Category Budgets</h2>
          <Button variant="ghost" size="sm" onClick={() => setShowAddBudget(!showAddBudget)}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {showAddBudget && (
          <div className="bg-card rounded-xl shadow-card p-4 space-y-3 animate-scale-in">
            <Input
              placeholder="Category name"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Budget limit (RM)"
              value={newLimit}
              onChange={(e) => setNewLimit(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={handleAddBudget} className="flex-1">
                Add Budget
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowAddBudget(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {budgets.map((budget) => {
          const percentage = (budget.spent / budget.limit) * 100;
          const isOverBudget = percentage >= 90;
          const isRecommended = budget.isRecommended;
          return (
            <div 
              key={budget.id} 
              className={cn(
                "bg-card rounded-xl shadow-card p-4 border-2 transition-all",
                isRecommended && getFlexibilityColor(budget.flexibility)
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{budget.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{budget.category}</p>
                      {isRecommended && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          AI Recommended
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      RM {budget.spent.toFixed(2)} / RM {budget.limit.toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      {budget.flexibility && (
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          budget.flexibility === "high" && "bg-accent/20 text-accent",
                          budget.flexibility === "medium" && "bg-primary/20 text-primary",
                          budget.flexibility === "low" && "bg-muted text-muted-foreground"
                        )}>
                          {budget.flexibility === "high" ? "Flexible" : budget.flexibility === "medium" ? "Moderate" : "Fixed"}
                        </span>
                      )}
                      {isOverBudget && (
                        <span className="flex items-center gap-1 text-destructive text-xs">
                          <AlertCircle className="w-3 h-3" />
                          Near limit
                        </span>
                      )}
                    </div>
                  </div>
                  {budget.recommendation && (
                    <p className="text-xs text-muted-foreground mt-1 italic">
                      {budget.recommendation}
                    </p>
                  )}
                </div>
              </div>
              <Progress
                value={Math.min(percentage, 100)}
                className={cn(
                  "h-2",
                  isOverBudget && "[&>div]:bg-destructive",
                  budget.flexibility === "high" && !isOverBudget && "[&>div]:bg-accent",
                  budget.flexibility === "medium" && !isOverBudget && "[&>div]:bg-primary"
                )}
              />
            </div>
          );
        })}
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl shadow-card p-5 animate-slide-up border border-primary/20" style={{ animationDelay: "150ms" }}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">AI Budget Insights</h2>
              <p className="text-xs text-muted-foreground">Personalized recommendations for you</p>
            </div>
          </div>
          <div className="space-y-3">
            {aiInsights.map((insight, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 bg-background/50 rounded-xl border border-primary/10"
              >
                <Lightbulb className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <p className="text-sm text-foreground leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Recommendations */}
      <div className="bg-card rounded-2xl shadow-card p-5 animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-foreground">Smart Budget Tips</h2>
        </div>
        <div className="space-y-3">
          {budgets
            .filter((b) => b.flexibility === "high" && b.recommendation)
            .slice(0, 3)
            .map((budget, index) => {
              const recommendations = generateAIRecommendations();
              const rec = recommendations.find((r) => r.category === budget.category);
              return (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-accent/5 rounded-xl border border-accent/20"
                >
                  <span className="text-2xl">{budget.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">{budget.category}</p>
                    <p className="text-xs text-muted-foreground mb-2">{budget.recommendation}</p>
                    {rec && rec.tips.length > 0 && (
                      <div className="space-y-1">
                        {rec.tips.slice(0, 2).map((tip, i) => (
                          <p key={i} className="text-xs text-accent">• {tip}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default BudgetPlannerPage;
