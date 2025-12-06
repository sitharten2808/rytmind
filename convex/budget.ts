import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { api } from "./_generated/api";

// Google Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent";

// Generate AI-powered budget recommendations
export const generateBudgetRecommendations = action({
  args: {
    income: v.number(),
    savingsGoal: v.number(),
    durationMonths: v.number(),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    budgets: Array<{
      category: string;
      suggestedBudget: number;
      currentSpending: number; // Real current month spending
      flexibility: "high" | "medium" | "low";
      reason: string;
      tips: string[];
      isEssential: boolean;
      isEnjoyment: boolean;
    }>;
    insights: string[];
    aiAnalysis: any;
  }> => {
    const { income, savingsGoal, durationMonths } = args;
    
    // Calculate current month boundaries
    const now = Date.now();
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    
    // Fetch current month transactions for real spending data
    const currentMonthTransactions: Array<{ 
      amount: number; 
      category: string; 
      emotion?: string;
      merchant: string;
      date: string;
      timestamp: number;
    }> = await ctx.runQuery(api.transactions.listByTimeRange, {
      startTimestamp: currentMonthStart,
      endTimestamp: now,
    });
    
    // Fetch last 90 days for pattern analysis (RAG context)
    const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
    const historicalTransactions: Array<{ 
      amount: number; 
      category: string; 
      emotion?: string;
      merchant: string;
      date: string;
    }> = await ctx.runQuery(api.transactions.listByTimeRange, {
      startTimestamp: ninetyDaysAgo,
      endTimestamp: now,
    });
    
    // Fetch journal entries for emotional context (RAG)
    const journalEntries: Array<{ 
      content: string; 
      mood: string;
      date: string;
      timestamp: number;
    }> = await ctx.runQuery(api.journalEntries.listByTimeRange, {
      startTimestamp: ninetyDaysAgo,
      endTimestamp: now,
    });
    
    // Calculate REAL current month spending by category
    const currentMonthSpending: Record<string, number> = {};
    currentMonthTransactions
      .filter((t: { amount: number }) => t.amount < 0)
      .forEach((t: { category: string; amount: number }) => {
        const cat = t.category || "Others";
        currentMonthSpending[cat] = (currentMonthSpending[cat] || 0) + Math.abs(t.amount);
      });
    
    // Calculate historical patterns for AI context
    const totalHistoricalSpending: number = historicalTransactions
      .filter((t: { amount: number }) => t.amount < 0)
      .reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0);
    
    const categoryMap: Record<string, { 
      amount: number; 
      count: number; 
      emotions: string[];
      monthlyAverage: number;
    }> = {};
    
    historicalTransactions
      .filter((t: { amount: number }) => t.amount < 0)
      .forEach((t: { category: string; amount: number; emotion?: string }) => {
        const cat = t.category || "Others";
        if (!categoryMap[cat]) {
          categoryMap[cat] = { amount: 0, count: 0, emotions: [], monthlyAverage: 0 };
        }
        categoryMap[cat].amount += Math.abs(t.amount);
        categoryMap[cat].count += 1;
        if (t.emotion) {
          categoryMap[cat].emotions.push(t.emotion);
        }
      });
    
    // Calculate monthly averages (90 days = ~3 months)
    Object.keys(categoryMap).forEach((cat) => {
      categoryMap[cat].monthlyAverage = categoryMap[cat].amount / 3;
    });
    
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([category, data]) => ({
        category,
        averageSpending: data.amount,
        monthlyAverage: data.monthlyAverage,
        frequency: data.count,
        percentage: totalHistoricalSpending > 0 ? (data.amount / totalHistoricalSpending) * 100 : 0,
        dominantEmotion: data.emotions.length > 0 
          ? data.emotions.reduce((a, b, _, arr) => 
              arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
            )
          : null,
        currentMonthSpending: currentMonthSpending[category] || 0,
      }))
      .sort((a, b) => b.averageSpending - a.averageSpending);
    
    // Calculate monthly savings needed
    const monthlySavingsNeeded = savingsGoal / durationMonths;
    const availableForSpending = income - monthlySavingsNeeded;
    
    // Prepare RAG context for Gemini
    const ragContext = {
      // User financial goals
      financialGoals: {
        monthlyIncome: income,
        savingsGoal,
        durationMonths,
        monthlySavingsNeeded,
        availableForSpending,
      },
      
      // Current month real spending
      currentMonthSpending: Object.entries(currentMonthSpending).map(([category, amount]) => ({
        category,
        amount,
        percentage: Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0) > 0
          ? (amount / Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0)) * 100
          : 0,
      })),
      
      // Historical spending patterns (last 90 days)
      spendingPatterns: categoryBreakdown.map((cat) => ({
        category: cat.category,
        monthlyAverage: cat.monthlyAverage,
        currentMonthSpending: cat.currentMonthSpending,
        frequency: cat.frequency,
        percentage: cat.percentage,
        dominantEmotion: cat.dominantEmotion,
        trend: cat.currentMonthSpending > cat.monthlyAverage ? "increasing" : 
               cat.currentMonthSpending < cat.monthlyAverage * 0.8 ? "decreasing" : "stable",
      })),
      
      // Emotional context from journals
      emotionalContext: {
        journalEntries: journalEntries.slice(0, 10).map((j: { content: string; mood: string; date: string }) => ({
          mood: j.mood,
          date: j.date,
          summary: j.content.substring(0, 100), // First 100 chars
        })),
        emotionalSpendingCategories: categoryBreakdown
          .filter((cat) => cat.dominantEmotion && ["Impulse", "Waste"].includes(cat.dominantEmotion))
          .map((cat) => cat.category),
      },
      
      // Recent transactions for context
      recentTransactions: historicalTransactions
        .filter((t: { amount: number }) => t.amount < 0)
        .slice(-20) // Last 20 transactions
        .map((t: { merchant: string; amount: number; category: string; date: string; emotion?: string }) => ({
          merchant: t.merchant,
          amount: Math.abs(t.amount),
          category: t.category,
          date: t.date,
          emotion: t.emotion,
        })),
    };
    
    // Create Gemini prompt with RAG context
    const geminiPrompt = `You are an AI financial advisor helping create a personalized budget plan.

USER FINANCIAL SITUATION:
- Monthly Income: RM ${income.toFixed(2)}
- Savings Goal: RM ${savingsGoal.toFixed(2)} (over ${durationMonths} months)
- Monthly Savings Needed: RM ${monthlySavingsNeeded.toFixed(2)}
- Available for Monthly Spending: RM ${availableForSpending.toFixed(2)}

CURRENT MONTH SPENDING (Real Data):
${ragContext.currentMonthSpending.map((s: { category: string; amount: number; percentage: number }) => 
  `- ${s.category}: RM ${s.amount.toFixed(2)} (${s.percentage.toFixed(1)}% of current spending)`
).join('\n')}

HISTORICAL SPENDING PATTERNS (Last 90 days):
${ragContext.spendingPatterns.map((p: { 
  category: string; 
  monthlyAverage: number; 
  currentMonthSpending: number;
  trend: string;
  dominantEmotion: string | null;
}) => 
  `- ${p.category}: Avg RM ${p.monthlyAverage.toFixed(2)}/month, Current: RM ${p.currentMonthSpending.toFixed(2)} (${p.trend} trend)${p.dominantEmotion ? `, Emotion: ${p.dominantEmotion}` : ''}`
).join('\n')}

EMOTIONAL CONTEXT:
${ragContext.emotionalContext.journalEntries.length > 0 
  ? `User's recent moods: ${ragContext.emotionalContext.journalEntries.map((e: { mood: string }) => e.mood).join(', ')}`
  : 'No recent journal entries'
}
${ragContext.emotionalContext.emotionalSpendingCategories.length > 0
  ? `Categories with emotional spending: ${ragContext.emotionalContext.emotionalSpendingCategories.join(', ')}`
  : ''
}

TASK:
Generate a personalized budget plan that SCALES WITH INCOME:
1. **CRITICAL**: The user has RM ${income.toFixed(2)}/month income and RM ${availableForSpending.toFixed(2)} available for spending after savings.
2. **IMPORTANT**: Budgets MUST scale proportionally with income. If income is high (RM 5k+), budgets should be higher. If income is low (RM 2k), budgets should be lower.
3. Use REAL current month spending as a baseline, but SCALE IT UP if income allows more spending.
4. For high income (RM ${income.toFixed(2)}), allocate more generously to enjoyment categories while still meeting savings goals.
5. For low income, keep budgets closer to current spending to ensure savings goals are met.
6. Total of all category budgets MUST equal approximately RM ${availableForSpending.toFixed(2)} (available for spending).
7. Allows flexibility for categories the user enjoys (Entertainment, Shopping) - give them MORE budget if income is high.
8. Keeps essential categories (Bills, Transport, Food) reasonable but can increase if income allows.
9. Considers emotional spending patterns.

SCALING RULES:
- If available spending (RM ${availableForSpending.toFixed(2)}) is MUCH HIGHER than current spending (RM ${Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0).toFixed(2)}), scale budgets UP proportionally.
- If available spending is similar to current spending, keep budgets close to current spending with small buffers.
- Essential categories: Scale 1.0x to 1.2x of current spending based on income level.
- Enjoyment categories: Scale 1.1x to 1.5x of current spending if income allows.
- Other categories: Scale 1.05x to 1.3x based on income level.

For each category, provide:
- suggestedBudget: Realistic monthly budget that SCALES WITH INCOME (RM ${income.toFixed(2)}). Higher income = higher budgets.
- flexibility: "high" (for enjoyment), "medium" (for others), or "low" (for essentials)
- reason: Brief explanation why this budget is recommended, mentioning income level
- tips: 2-3 actionable tips for managing this category

Return ONLY valid JSON in this exact format:
{
  "budgets": [
    {
      "category": "Food",
      "suggestedBudget": 600.00,
      "flexibility": "low",
      "reason": "Essential category - keeping close to current spending with small buffer",
      "tips": ["Meal prep to save money", "Track grocery spending weekly"],
      "isEssential": true,
      "isEnjoyment": false
    }
  ],
  "insights": [
    "Your current spending is RM ${Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0).toFixed(2)} this month",
    "You have RM ${(availableForSpending - Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0)).toFixed(2)} remaining for the rest of the month"
  ]
}`;
    
    try {
      // Call Google Gemini API
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY not configured. Please set it in Convex environment variables.");
      }
      
      const response: Response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: geminiPrompt
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }
      
      const geminiResult: any = await response.json();
      
      // Extract text from Gemini response
      const responseText = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text || "";
      
      if (!responseText) {
        throw new Error("No response from Gemini API");
      }
      
      // Parse JSON from Gemini response (it might have markdown code blocks)
      let parsedResult: any;
      try {
        // Try to extract JSON from markdown code blocks if present
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || 
                         responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                         [null, responseText];
        parsedResult = JSON.parse(jsonMatch[1] || responseText);
      } catch (parseError) {
        // If JSON parsing fails, try to extract just the JSON object
        const jsonObjectMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonObjectMatch) {
          parsedResult = JSON.parse(jsonObjectMatch[0]);
        } else {
          throw new Error("Could not parse Gemini response as JSON");
        }
      }
      
      // Validate and normalize budgets
      if (parsedResult.budgets && Array.isArray(parsedResult.budgets)) {
        // Ensure budgets fit within available spending
        const totalSuggested = parsedResult.budgets.reduce(
          (sum: number, b: any) => sum + (b.suggestedBudget || 0),
          0
        );
        
        if (totalSuggested > availableForSpending) {
          const scaleFactor = availableForSpending / totalSuggested;
          parsedResult.budgets.forEach((b: any) => {
            b.suggestedBudget = Math.round((b.suggestedBudget || 0) * scaleFactor * 100) / 100;
          });
        }
        
        // Add current spending to each budget
        const budgetsWithSpending = parsedResult.budgets.map((rec: any) => {
          const currentSpent = currentMonthSpending[rec.category] || 0;
          return {
            category: rec.category,
            suggestedBudget: Math.round((rec.suggestedBudget || 0) * 100) / 100,
            currentSpending: Math.round(currentSpent * 100) / 100,
            flexibility: rec.flexibility || "medium",
            reason: rec.reason || "AI-generated recommendation based on your spending patterns.",
            tips: rec.tips || [],
            isEssential: rec.isEssential || false,
            isEnjoyment: rec.isEnjoyment || false,
          };
        });
        
        return {
          success: true,
          budgets: budgetsWithSpending,
          insights: parsedResult.insights || [
            `AI analyzed your spending and created a personalized budget plan.`,
            `Current month spending: RM ${Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0).toFixed(2)}`,
          ],
          aiAnalysis: {
            summary: `Generated ${budgetsWithSpending.length} budget recommendations using Gemini AI`,
            source: "gemini-pro",
          },
        };
      }
      
      throw new Error("Invalid response format from Gemini");
      
    } catch (error: any) {
      console.error("Gemini API error:", error);
      
      // Fallback: Generate intelligent budgets using real current spending, SCALED BY INCOME
      const totalCurrentSpending = Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0);
      const incomeScaleFactor = totalCurrentSpending > 0 
        ? Math.min(availableForSpending / totalCurrentSpending, 2.0) // Cap at 2x to avoid excessive scaling
        : 1.0;
      
      const generatedBudgets = categoryBreakdown.map((cat) => {
        const currentSpent = cat.currentMonthSpending;
        const monthlyAvg = cat.monthlyAverage;
        const isEssential = ["Bills", "Transport", "Food"].includes(cat.category);
        const isEnjoyment = ["Entertainment", "Shopping"].includes(cat.category);
        
        // Calculate base budget from current spending or historical average
        let baseBudget: number;
        if (currentSpent > 0) {
          baseBudget = currentSpent;
        } else {
          baseBudget = monthlyAvg;
        }
        
        // Scale based on income level and category type
        let suggestedBudget: number;
        let flexibility: "high" | "medium" | "low";
        let reason: string;
        const tips: string[] = [];
        
        if (isEssential) {
          // Essentials: Scale 1.0x to 1.3x based on income, but keep reasonable
          const essentialScale = income > 4000 ? Math.min(incomeScaleFactor * 1.1, 1.3) : 1.1;
          suggestedBudget = baseBudget * essentialScale;
          flexibility = "low";
          reason = `Based on your RM ${income.toFixed(2)}/month income and current spending of RM ${currentSpent.toFixed(2)}, we recommend RM ${suggestedBudget.toFixed(2)}/month for this essential category.`;
          tips.push("Track bills closely to avoid surprises");
          tips.push("Set up auto-payments for consistency");
        } else if (isEnjoyment) {
          // Enjoyment: Scale more generously if income is high
          const enjoymentScale = income > 4000 ? Math.min(incomeScaleFactor * 1.3, 1.8) : 1.2;
          suggestedBudget = baseBudget * enjoymentScale;
          flexibility = "high";
          reason = `With RM ${income.toFixed(2)}/month income, we suggest RM ${suggestedBudget.toFixed(2)}/month here (current: RM ${currentSpent.toFixed(2)}) to enjoy yourself while staying on track.`;
          tips.push("Treat yourself, but set weekly limits");
          tips.push("Look for deals and discounts");
        } else {
          // Other categories: Moderate scaling
          const otherScale = income > 4000 ? Math.min(incomeScaleFactor * 1.2, 1.5) : 1.15;
          suggestedBudget = baseBudget * otherScale;
          flexibility = "medium";
          reason = `Based on your RM ${income.toFixed(2)}/month income, we recommend RM ${suggestedBudget.toFixed(2)}/month for this category (current: RM ${currentSpent.toFixed(2)}).`;
          tips.push("Review monthly to adjust as needed");
        }
        
        return {
          category: cat.category,
          suggestedBudget: Math.round(suggestedBudget * 100) / 100,
          currentSpending: Math.round(currentSpent * 100) / 100,
          flexibility,
          reason,
          tips,
          isEssential,
          isEnjoyment,
        };
      });
      
      // Normalize budgets to fit available spending (ensure they use the full available budget)
      const totalSuggested = generatedBudgets.reduce((sum, b) => sum + b.suggestedBudget, 0);
      if (totalSuggested > 0) {
        // Scale all budgets proportionally to use available spending
        const scaleFactor = availableForSpending / totalSuggested;
        generatedBudgets.forEach((b) => {
          b.suggestedBudget = Math.round(b.suggestedBudget * scaleFactor * 100) / 100;
        });
      }
      
      return {
        success: true,
        budgets: generatedBudgets,
        insights: [
          `Generated budget recommendations based on your real spending data.`,
          `Current month spending: RM ${Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0).toFixed(2)}`,
          `Available for rest of month: RM ${(availableForSpending - Object.values(currentMonthSpending).reduce((sum, a) => sum + a, 0)).toFixed(2)}`,
        ],
        aiAnalysis: {
          summary: "Fallback: Generated using intelligent analysis of real spending data",
          source: "local-analysis",
        },
      };
    }
  },
});

// Store budget plan
export const storeBudgetPlan = mutation({
  args: {
    income: v.number(),
    savingsGoal: v.number(),
    durationMonths: v.number(),
    budgets: v.array(v.object({
      category: v.string(),
      limit: v.number(),
      flexibility: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    // You can add a budgets table to schema if you want to persist budget plans
    // For now, we'll just return success
    return { success: true };
  },
});

// Get current month spending by category (for real-time updates)
export const getCurrentMonthSpending = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
    
    const transactions = await ctx.runQuery(api.transactions.listByTimeRange, {
      startTimestamp: currentMonthStart,
      endTimestamp: now,
    });
    
    const spendingByCategory: Record<string, number> = {};
    transactions
      .filter((t: { amount: number }) => t.amount < 0)
      .forEach((t: { category: string; amount: number }) => {
        const cat = t.category || "Others";
        spendingByCategory[cat] = (spendingByCategory[cat] || 0) + Math.abs(t.amount);
      });
    
    return spendingByCategory;
  },
});

