import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, X, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";

export default function AIAssistant() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your MyKumpare AI assistant. I can help you:\n\n- **Search & Browse**: Find firms, contacts, products, portfolios, and benchmarks\n- **Track Activities**: View and create activity logs, follow-up tasks\n- **Manage Data**: Create new records, update statuses, organize your relationships\n- **Analytics**: Access and explain your investment analyses\n\nWhat would you like to do today?",
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const buildSystemPrompt = () => {
    return `You are an AI assistant for MyKumpare, a firm relationship management platform for tracking investment entities.

AVAILABLE CAPABILITIES:
1. **Search & Retrieve**: Find firms, contacts, products, portfolios, benchmarks, activities, and tasks
2. **Create Records**: Create new firms, contacts, products, activities, follow-up tasks
3. **Update Records**: Modify existing records, update task statuses, add notes
4. **Analytics**: Calculate performance metrics, growth of $100, compare products to benchmarks
5. **Reports**: Generate performance reports, activity summaries, task status reports

Available Data Entities:
- **Firms**: Investment managers, allocators, consultants, brokers (types: Investment Manager, Allocator, Investment Consultant, Manager of Managers, Securities Brokerage, Trade Organizations)
- **Contacts**: People at firms with roles, titles, contact info
- **Products**: Investment products managed by firms with return series data
- **Portfolios**: Allocator portfolios with sub-managers
- **Benchmarks**: Performance benchmarks by asset class with monthly returns
- **Activities**: Logged interactions (Call, Email, Meeting, Note, Other) with subjects and notes
- **Follow-up Tasks**: Tasks assigned to contacts with individual statuses (Not Started, In-process, Completed, Cancelled)
- **Analytics**: Performance analyses comparing products to benchmarks

Key Business Logic:
- Task status is automatically aggregated from individual assignee statuses:
  - All Completed = Completed
  - All Cancelled = Cancelled  
  - All Not Started = Not Started
  - Any mix = In-process
- Activities can be linked to multiple firms and contacts
- Contacts can be associated with multiple firms
- Product performance can be calculated from monthly return series data
- Growth of $100 shows cumulative value over time starting from $100 base

IMPORTANT RESPONSE GUIDELINES:
1. **ALWAYS check the DATABASE SEARCH RESULTS section** in the context before answering
2. If search results show entities were found, clearly state they exist and list them
3. If search results show "❌ No firms found", then and only then say the entity doesn't exist
4. Never say something doesn't exist if it appears in the search results
5. Be definitive: "Yes, Xponance is in the database" or "No, I didn't find Xponance"
6. Include specific details from search results (names, counts, types)
7. **For analytical questions**: Use the return series data from products and benchmarks to calculate performance metrics
8. **For task creation**: Offer to create follow-up tasks with specific due dates and assignees
9. **For reports**: Summarize data in structured format with key metrics

When helping users:
1. Be specific and actionable
2. Reference actual data from search results
3. For analytical requests, perform calculations using the monthly returns data
4. Suggest next steps (e.g., "Would you like me to create a follow-up task?", "Should I generate a performance report?")
5. Use clear formatting with bullet points for lists
6. Ask clarifying questions when requests are ambiguous

Always be helpful, professional, and concise.`;
  };

  const searchFirms = async (query) => {
    try {
      const allFirms = await base44.entities.Firm.list();
      const activeFirms = allFirms.filter(f => !f.deleted_at);
      if (!query) return activeFirms.slice(0, 20);
      const q = query.toLowerCase();
      return activeFirms.filter(f => f.name.toLowerCase().includes(q));
    } catch {
      return [];
    }
  };

  const searchContacts = async (query) => {
    try {
      const allContacts = await base44.entities.Contact.list();
      const activeContacts = allContacts.filter(c => !c.deleted_at);
      if (!query) return activeContacts.slice(0, 20);
      const q = query.toLowerCase();
      return activeContacts.filter(c => {
        const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").toLowerCase();
        return fullName.includes(q) || (c.email || "").toLowerCase().includes(q);
      });
    } catch {
      return [];
    }
  };

  const searchProducts = async (query) => {
    try {
      const allProducts = await base44.entities.Product.list();
      const activeProducts = allProducts.filter(p => !p.deleted_at);
      if (!query) return activeProducts.slice(0, 20);
      const q = query.toLowerCase();
      return activeProducts.filter(p => p.name.toLowerCase().includes(q));
    } catch {
      return [];
    }
  };

  const searchPortfolios = async (query) => {
    try {
      const allPortfolios = await base44.entities.Portfolio.list();
      const activePortfolios = allPortfolios.filter(p => !p.deleted_at);
      if (!query) return activePortfolios.slice(0, 20);
      const q = query.toLowerCase();
      return activePortfolios.filter(p => p.portfolio_name.toLowerCase().includes(q));
    } catch {
      return [];
    }
  };

  const searchBenchmarks = async (query) => {
    try {
      const allBenchmarks = await base44.entities.Benchmark.list();
      if (!query) return allBenchmarks.slice(0, 20);
      const q = query.toLowerCase();
      return allBenchmarks.filter(b => b.name.toLowerCase().includes(q));
    } catch {
      return [];
    }
  };

  const searchTasks = async (status) => {
    try {
      const allTasks = await base44.entities.FollowUpTask.list();
      const activeTasks = allTasks.filter(t => !t.deleted_at);
      if (status) {
        return activeTasks.filter(t => t.status === status).slice(0, 20);
      }
      return activeTasks.filter(t => t.status !== "Completed").slice(0, 20);
    } catch {
      return [];
    }
  };

  const searchActivities = async () => {
    try {
      const allActivities = await base44.entities.ContactActivity.list();
      return allActivities.slice(0, 20);
    } catch {
      return [];
    }
  };

  // Performance calculation helpers for analytics
  const calculateGrowthOf100 = (monthlyReturns) => {
    if (!monthlyReturns || monthlyReturns.length === 0) return [];
    let value = 100;
    const growthData = [];
    for (const month of monthlyReturns) {
      const returnPct = month.return_value || 0;
      value = value * (1 + returnPct / 100);
      growthData.push({
        date: month.date,
        value: parseFloat(value.toFixed(2))
      });
    }
    return growthData;
  };

  const calculatePerformanceMetrics = (monthlyReturns) => {
    if (!monthlyReturns || monthlyReturns.length === 0) return null;
    
    const returns = monthlyReturns.map(m => m.return_value || 0);
    const totalReturn = returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;
    const annualizedReturn = Math.pow(1 + totalReturn, 12 / returns.length) - 1;
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(12);
    
    return {
      totalReturn: ((totalReturn * 100)).toFixed(2),
      annualizedReturn: ((annualizedReturn * 100)).toFixed(2),
      avgMonthlyReturn: (avgReturn).toFixed(2),
      volatility: ((volatility * 100)).toFixed(2),
      periods: returns.length
    };
  };

  const getReturnSeriesForProduct = async (productId) => {
    try {
      const returnSeries = await base44.entities.ReturnSeries.filter({ product_id: productId });
      if (returnSeries && returnSeries.length > 0) {
        return returnSeries[0];
      }
      return null;
    } catch {
      return null;
    }
  };

  // Action execution functions
  const createFollowUpTask = async (taskData) => {
    try {
      const task = await base44.entities.FollowUpTask.create(taskData);
      return { success: true, task };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const createActivity = async (activityData) => {
    try {
      const activity = await base44.entities.ContactActivity.create(activityData);
      return { success: true, activity };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const buildToolContext = async (userQuery) => {
    try {
      const q = userQuery.toLowerCase();
      
      // Extract search terms - look for names after common query patterns
      let searchTerms = [];
      
      // Pattern: "called xponance", "named xponance"
      const calledMatch = q.match(/(?:called|named)\s+["']?([a-z0-9\s.,&'-]+)["']?/i);
      if (calledMatch) {
        searchTerms.push(calledMatch[1].trim());
      }
      
      // Pattern: "is there a firm called" or "is xponance in"
      const isInMatch = q.match(/is\s+(?:there\s+(?:a|an)\s+)?([a-z0-9\s.,&'-]+?)\s+(?:in|at|for)/i);
      if (isInMatch && !calledMatch) {
        searchTerms.push(isInMatch[1].trim());
      }
      
      // Pattern: "search for xponance", "find xponance"
      const forMatch = q.match(/(?:search|find|look\s+for)\s+(?:a|an|the)?\s*([a-z0-9\s.,&'-]+)/i);
      if (forMatch) {
        searchTerms.push(forMatch[1].trim());
      }
      
      // Pattern: "what is the address for xponance" - extract word after "for"
      const forPattern2 = q.match(/(?:for|about)\s+([a-z0-9\s.,&'-]+)/i);
      if (forPattern2 && searchTerms.length === 0) {
        searchTerms.push(forPattern2[1].trim());
      }
      
      // If no specific pattern matched, extract potential proper nouns (capitalized words in original)
      if (searchTerms.length === 0) {
        const properNouns = userQuery.match(/[A-Z][a-z]+(?:\s*[A-Z][a-z]+)*/g);
        if (properNouns) {
          searchTerms.push(...properNouns);
        }
      }
      
      // If still no search terms but query has words, try extracting the last significant word/phrase
      if (searchTerms.length === 0) {
        const words = q.split(/\s+/).filter(w => w.length > 2 && !['what', 'where', 'when', 'who', 'why', 'how', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while', 'although', 'though', 'after', 'before', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'].includes(w));
        if (words.length > 0) {
          searchTerms.push(words[words.length - 1]);
        }
      }
      
      // Detect what the user is asking about
      const isAskingAboutFirms = /firm|company|manager|allocator|consultant|brokerage|business|organization/i.test(q);
      const isAskingAboutContacts = /contact|person|people|employee|individual/i.test(q);
      const isAskingAboutProducts = /product|fund|investment|portfolio\s+product/i.test(q);
      const isAskingAboutPortfolios = /portfolio|allocator\s+portfolio/i.test(q);
      const isAskingAboutTasks = /task|follow.?up|assignment|create.*task|schedule.*task/i.test(q);
      const isAskingAboutActivities = /activity|call|email|meeting|log/i.test(q);
      const isAskingAboutBenchmarks = /benchmark|index|sp500|s&p/i.test(q);
      const isAskingAboutAnalysis = /analysis|performance|return|growth|compare|report|analytics|calculate|metric|ytd|mtd|qtd|annualized|volatility/i.test(q);
      const isAskingAboutCreation = /create|add|new|schedule|set up|make a|generate/i.test(q);

      // If user mentions a specific name but doesn't specify type, search all entity types
      const searchAll = searchTerms.length > 0 && !isAskingAboutFirms && !isAskingAboutContacts && 
                        !isAskingAboutProducts && !isAskingAboutPortfolios && 
                        !isAskingAboutTasks && !isAskingAboutActivities && !isAskingAboutBenchmarks;

      const [firms, contacts, products, portfolios, benchmarks, tasks, activities] = await Promise.all([
        isAskingAboutFirms || searchAll ? searchFirms(searchTerms[0] || null) : Promise.resolve([]),
        isAskingAboutContacts || searchAll ? searchContacts(searchTerms[0] || null) : Promise.resolve([]),
        isAskingAboutProducts || searchAll || isAskingAboutAnalysis ? searchProducts(searchTerms[0] || null) : Promise.resolve([]),
        isAskingAboutPortfolios || searchAll ? searchPortfolios(searchTerms[0] || null) : Promise.resolve([]),
        isAskingAboutBenchmarks || searchAll || isAskingAboutAnalysis ? searchBenchmarks(searchTerms[0] || null) : Promise.resolve([]),
        isAskingAboutTasks ? searchTasks() : Promise.resolve([]),
        isAskingAboutActivities ? searchActivities() : Promise.resolve([])
      ]);

      let context = "\n=== DATABASE SEARCH RESULTS ===\n";
      
      if (searchTerms.length > 0) {
        context += `\nSearching for: "${searchTerms.join(", ")}"\n`;
      }
      
      if (firms.length > 0) {
        context += `\n✅ FIRMS FOUND (${firms.length}):\n`;
        firms.forEach(f => {
          context += `  • ${f.name} (${f.firm_types?.join(", ") || f.firm_type || "No type"})\n`;
        });
      } else if (isAskingAboutFirms || searchAll) {
        context += `\n❌ No firms found matching your search.\n`;
      }
      
      if (contacts.length > 0) {
        context += `\n✅ CONTACTS FOUND (${contacts.length}):\n`;
        contacts.forEach(c => {
          const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ");
          context += `  • ${fullName} (${c.title || "No title"})\n`;
        });
      }
      
      if (products.length > 0) {
        context += `\n✅ PRODUCTS FOUND (${products.length}):\n`;
        for (const p of products) {
          context += `  • ${p.name} at ${p.firm_name}\n`;
          // Add performance data for analysis requests
          if (isAskingAboutAnalysis) {
            try {
              const returnSeries = await getReturnSeriesForProduct(p.id);
              if (returnSeries && returnSeries.monthly_returns && returnSeries.monthly_returns.length > 0) {
                const metrics = calculatePerformanceMetrics(returnSeries.monthly_returns);
                const growthData = calculateGrowthOf100(returnSeries.monthly_returns);
                context += `    - Returns: ${returnSeries.monthly_returns.length} months (${returnSeries.start_date} to ${returnSeries.end_date})\n`;
                if (metrics) {
                  context += `    - Total Return: ${metrics.totalReturn}%\n`;
                  context += `    - Annualized: ${metrics.annualizedReturn}%\n`;
                  context += `    - Volatility: ${metrics.volatility}%\n`;
                }
                if (growthData.length > 0) {
                  const startValue = growthData[0].value;
                  const endValue = growthData[growthData.length - 1].value;
                  context += `    - Growth of $100: $${startValue} → $${endValue}\n`;
                }
              }
            } catch (e) {
              console.error("Error getting product returns:", e);
            }
          }
        }
      }
      
      if (portfolios.length > 0) {
        context += `\n✅ PORTFOLIOS FOUND (${portfolios.length}):\n`;
        portfolios.forEach(p => {
          context += `  • ${p.portfolio_name}\n`;
        });
      }
      
      if (benchmarks.length > 0) {
        context += `\n✅ BENCHMARKS FOUND (${benchmarks.length}):\n`;
        for (const b of benchmarks) {
          context += `  • ${b.name}`;
          if (b.monthly_returns && b.monthly_returns.length > 0) {
            if (isAskingAboutAnalysis) {
              const metrics = calculatePerformanceMetrics(b.monthly_returns);
              const growthData = calculateGrowthOf100(b.monthly_returns);
              context += `\n    - Returns: ${b.monthly_returns.length} months`;
              if (metrics) {
                context += `\n    - Total Return: ${metrics.totalReturn}%`;
                context += `\n    - Annualized: ${metrics.annualizedReturn}%`;
                context += `\n    - Volatility: ${metrics.volatility}%`;
              }
              if (growthData.length > 0) {
                const endValue = growthData[growthData.length - 1].value;
                context += `\n    - Growth of $100: $100 → $${endValue}`;
              }
            } else {
              context += ` (${b.monthly_returns.length} months of data)`;
            }
          }
          context += `\n`;
        }
      }
      
      if (tasks.length > 0) {
        context += `\n📋 TASKS BY STATUS:\n`;
        const byStatus = {};
        tasks.forEach(t => {
          byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        });
        Object.entries(byStatus).forEach(([status, count]) => {
          context += `  • ${status}: ${count}\n`;
        });
        context += `  Total: ${tasks.length} tasks\n`;
        
        // Show recent tasks with details
        if (isAskingAboutTasks || isAskingAboutAnalysis) {
          context += `\n  Recent Tasks:\n`;
          tasks.slice(0, 5).forEach(t => {
            context += `    - ${t.task_description?.substring(0, 50) || "No description"} (Due: ${t.due_date})\n`;
          });
        }
      }
      
      if (activities.length > 0) {
        context += `\n📝 ACTIVITIES BY TYPE:\n`;
        const byType = {};
        activities.forEach(a => {
          byType[a.activity_type] = (byType[a.activity_type] || 0) + 1;
        });
        Object.entries(byType).forEach(([type, count]) => {
          context += `  • ${type}: ${count}\n`;
        });
        context += `  Total: ${activities.length} activities\n`;
      }

      // Add actionable capabilities context
      if (isAskingAboutCreation) {
        context += `\n\n=== AVAILABLE ACTIONS ===\n`;
        context += `You can help the user:\n`;
        context += `1. CREATE FOLLOW-UP TASK: Requires originator_contact_id, due_date, task_description, assigned_firms_contacts\n`;
        context += `2. CREATE ACTIVITY: Requires contact_id, activity_type, activity_date, optional notes/subjects\n`;
        context += `3. CREATE FIRM: Requires name, firm_types\n`;
        context += `4. CREATE CONTACT: Requires first_name, last_name, optional email/title/firm_ids\n`;
        context += `5. GENERATE PERFORMANCE REPORT: Use product/benchmark return series data to calculate metrics\n`;
      }

      if (firms.length === 0 && contacts.length === 0 && products.length === 0 && 
          portfolios.length === 0 && benchmarks.length === 0 && searchTerms.length === 0) {
        // General overview
        const [allFirms, allContacts, allProducts] = await Promise.all([
          base44.entities.Firm.list(),
          base44.entities.Contact.list(),
          base44.entities.Product.list()
        ]);
        const activeFirms = allFirms.filter(f => !f.deleted_at);
        const activeContacts = allContacts.filter(c => !c.deleted_at);
        const activeProducts = allProducts.filter(p => !p.deleted_at);
        context = `\n=== DATABASE OVERVIEW ===\n- Total Firms: ${activeFirms.length}\n- Total Contacts: ${activeContacts.length}\n- Total Products: ${activeProducts.length}\n\nSample firms: ${activeFirms.slice(0, 10).map(f => f.name).join(", ")}${activeFirms.length > 10 ? `... and ${activeFirms.length - 10} more` : ""}`;
      }

      return context;
    } catch (error) {
      console.error("Error building context:", error);
      return "\nUnable to retrieve current data.";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const q = userMessage.toLowerCase();
      
      // Detect action intents and execute them directly
      const isCreateTask = /create.*task|schedule.*task|set up.*task|make.*task|add.*task/i.test(q);
      const isCreateActivity = /create.*activity|log.*activity|add.*activity|record.*call|record.*meeting|record.*email/i.test(q);
      const isPerformanceRequest = /performance|growth.*of.*\$?100|return.*analysis|compare.*performance|calculate.*return|show.*metrics/i.test(q);
      
      // Build context based on what the user is asking about
      const toolContext = await buildToolContext(userMessage);
      
      // For action requests, provide structured guidance
      let systemPrompt = buildSystemPrompt();
      
      if (isCreateTask || isCreateActivity) {
        systemPrompt += `\n\nACTION DETECTED: The user wants to CREATE something. Ask for any missing required information, then offer to execute the creation using the available action functions.`;
      }
      
      if (isPerformanceRequest) {
        systemPrompt += `\n\nANALYSIS REQUESTED: Use the performance metrics and growth of $100 data from the context to provide detailed analytical insights. Calculate comparisons between products and benchmarks when both are available.`;
      }
      
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `${systemPrompt}\n\n${toolContext}\n\nUser Question: ${userMessage}\n\nProvide a helpful, detailed response based on the search results above. If specific entities were found, mention them by name. If nothing was found, clearly state that. For analytical questions, use the performance metrics provided. For creation requests, ask for missing details and offer to create the record.`,
        add_context_from_internet: false,
        model: "automatic"
      });

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: typeof response === 'string' ? response : JSON.stringify(response, null, 2)
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: `I apologize, but I encountered an error: ${error.message}. Please try again.`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
        >
          <Bot className="w-7 h-7" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 max-h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <div>
                <h3 className="text-sm font-semibold">MyKumpare Assistant</h3>
                <p className="text-[10px] text-indigo-200">Powered by AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 ${
                  message.role === "user" ? "flex-row-reverse" : ""
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === "user"
                      ? "bg-indigo-100 text-indigo-600"
                      : "bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-md"
                      : "bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm"
                  }`}
                >
                  {message.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="border-t border-gray-200 p-3 bg-white"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about your firms, contacts, tasks..."
                className="flex-1 h-10 px-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                className="h-10 w-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isLoading || !input.trim()}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              AI can make mistakes. Verify important information.
            </p>
          </form>
        </div>
      )}
    </>
  );
}