import { TrendingUp, TrendingDown, Target, Award, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Transaction } from "./TransactionsPage";

interface InsightsPageProps {
  transactions: Transaction[];
}

const InsightsPage = ({ transactions }: InsightsPageProps) => {
  // Calculate insights from transactions
  const totalSpending = transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const processedCount = transactions.filter(t => t.processed).length;
  const totalCount = transactions.length;
  const processedPercentage = totalCount > 0 ? (processedCount / totalCount) * 100 : 0;

  // Calculate spending by category
  const categorySpending = transactions.reduce((acc, t) => {
    const category = t.category || "Others";
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += Math.abs(t.amount);
    return acc;
  }, {} as Record<string, number>);

  const topCategory = Object.entries(categorySpending).sort((a, b) => b[1] - a[1])[0];

  // Calculate emotional spending patterns
  const emotionCounts = transactions.reduce((acc, t) => {
    const emotion = t.emotion || "Unknown";
    if (!acc[emotion]) {
      acc[emotion] = 0;
    }
    acc[emotion]++;
    return acc;
  }, {} as Record<string, number>);

  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];

  const insights = [
    {
      id: "total-spending",
      title: "Total Spending",
      value: `RM ${totalSpending.toFixed(2)}`,
      subtitle: `${transactions.length} transactions`,
      icon: TrendingUp,
      color: "bg-primary/10 text-primary",
    },
    {
      id: "processed",
      title: "Insights Analyzed",
      value: `${processedCount}`,
      subtitle: `${processedPercentage.toFixed(0)}% of transactions`,
      icon: Sparkles,
      color: "bg-accent/10 text-accent",
    },
    {
      id: "top-category",
      title: "Top Category",
      value: topCategory ? topCategory[0] : "N/A",
      subtitle: topCategory ? `RM ${topCategory[1].toFixed(2)}` : "No data",
      icon: Target,
      color: "bg-success/10 text-success",
    },
    {
      id: "top-emotion",
      title: "Dominant Emotion",
      value: topEmotion ? topEmotion[0] : "N/A",
      subtitle: topEmotion ? `${topEmotion[1]} transactions` : "No data",
      icon: Award,
      color: "bg-primary/10 text-primary",
    },
  ];

  const recommendations = [
    {
      type: "success",
      title: "Great Progress!",
      message: `You've analyzed ${processedCount} transactions. Keep tracking your emotional spending patterns.`,
      icon: Award,
    },
    {
      type: "info",
      title: "Complete Your Analysis",
      message: `${totalCount - processedCount} transaction${totalCount - processedCount !== 1 ? "s" : ""} still need analysis. Add receipts or manual entries to get insights.`,
      icon: AlertCircle,
    },
  ];

  return (
    <div className="flex-1 px-4 py-6 space-y-6 pb-24">
      {/* Header */}
     
      
    </div>
  );
};

export default InsightsPage;

