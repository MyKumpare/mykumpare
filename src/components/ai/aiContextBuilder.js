import { base44 } from "@/api/base44Client";

// ─── Performance calculations ───
const calculateGrowthOf100 = (monthlyReturns) => {
  if (!monthlyReturns || monthlyReturns.length === 0) return [];
  let value = 100;
  return monthlyReturns.map((m) => {
    value = value * (1 + (m.return_value || 0) / 100);
    return { month: m.date, value: parseFloat(value.toFixed(2)) };
  });
};

const calculatePerformanceMetrics = (monthlyReturns) => {
  if (!monthlyReturns || monthlyReturns.length === 0) return null;
  const returns = monthlyReturns.map((m) => m.return_value || 0);
  const totalReturn = returns.reduce((acc, r) => acc * (1 + r / 100), 1) - 1;
  const annualizedReturn = Math.pow(1 + totalReturn, 12 / returns.length) - 1;
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance) * Math.sqrt(12);
  return {
    totalReturn: (totalReturn * 100).toFixed(2),
    annualizedReturn: (annualizedReturn * 100).toFixed(2),
    avgMonthlyReturn: avgReturn.toFixed(2),
    volatility: (volatility * 100).toFixed(2),
    periods: returns.length,
  };
};

// ─── Entity simplification ───
const simplifyFirm = (f) => ({
  name: f.name,
  type: f.firm_types?.join(", ") || f.firm_type || "",
  website: f.website || "",
  year_founded: f.year_founded || "",
  city: f.addresses?.[0]?.city || "",
  state: f.addresses?.[0]?.state || "",
});

const simplifyContact = (c) => ({
  name: [c.first_name, c.last_name].filter(Boolean).join(" "),
  title: c.title || "",
  email: c.email || "",
  contact_type: Array.isArray(c.contact_type) ? c.contact_type.join(", ") : (c.contact_type || ""),
  contact_status: c.contact_status || "",
});

const simplifyProduct = (p) => ({
  name: p.name,
  firm_name: p.firm_name || "",
  product_type: p.product_type || "",
  asset_class: p.asset_class || "",
  geography: p.geography || "",
  style: p.style || "",
});

const simplifyPortfolio = (p) => ({
  portfolio_name: p.portfolio_name,
  allocator_name: p.allocator_name || "",
  advisor_firm_name: p.advisor_firm_name || "",
  advisor_type: p.advisor_type || "",
  inception_date: p.inception_date || "",
});

const simplifyBenchmark = (b) => ({
  name: b.name,
  asset_class: b.asset_class || "",
  region: b.region || "",
  market_capitalization: b.market_capitalization || "",
  style: b.style || "",
});

const simplifyTask = (t) => ({
  description: (t.task_description || "").substring(0, 60),
  status: t.status || "",
  due_date: t.due_date || "",
  assignee: t.assigned_to_contact_name || "",
  originator: t.originator_contact_name || "",
});

const simplifyActivity = (a) => ({
  type: a.activity_type || "",
  date: a.activity_date || "",
  notes: (a.notes || "").substring(0, 60),
});

const simplifyAnalysis = (a) => ({
  name: a.name,
  analysis_type: a.analysis_type || "",
  period_start: a.period_start || "",
  period_end: a.period_end || "",
  visibility: a.visibility || "",
});

// ─── Distribution computation ───
const computeDistribution = (items, getKeys) => {
  const dist = {};
  items.forEach((item) => {
    const keys = getKeys(item);
    keys.forEach((k) => {
      dist[k] = (dist[k] || 0) + 1;
    });
  });
  return Object.entries(dist)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
};

const sampleGrowth = (growthData, maxPoints = 24) => {
  if (growthData.length <= maxPoints) return growthData;
  const step = Math.ceil(growthData.length / maxPoints);
  return growthData.filter((_, i) => i % step === 0);
};

// ─── System prompt ───
export const buildSystemPrompt = () => {
  return `You are an AI assistant for MyKumpare, a firm relationship management platform for tracking investment entities.

AVAILABLE DATA:
The context includes data from all entities in the application:
- Firms (investment managers, allocators, consultants, brokers)
- Contacts (people at firms with roles, titles, contact info)
- Products (investment products with return series data)
- Portfolios (allocator portfolios with sub-managers)
- Benchmarks (performance benchmarks with monthly returns)
- Activities (logged interactions: calls, emails, meetings, notes)
- Tasks (follow-up tasks with statuses and assignments)
- Analyses (performance analyses comparing products to benchmarks)
- Return Series (monthly return data for products and benchmarks)

RESPONSE FORMAT:
You MUST respond using the JSON schema with these fields:
- "text" (required): Markdown text for explanations, summaries, and answers
- "tables" (optional): Array of table objects for presenting tabular data. Each table: { "title": string, "headers": [string], "rows": [[string]] }
- "charts" (optional): Array of chart objects for visualizations. Each chart: { "title": string, "chart_type": "bar"|"line"|"pie"|"area", "data": [{key: value}], "x_key": string, "y_key": string }

FORMAT SELECTION:
- Text only: Simple Q&A, explanations, advice
- Table: Lists of entities, comparison data, detailed records with multiple attributes
- Bar chart: Distributions, counts by category (e.g., firms by type, tasks by status)
- Line chart: Trends over time (e.g., growth of $100, performance over months)
- Pie chart: Proportions/percentages (e.g., task completion rate)
- Area chart: Cumulative values over time
- Combination: Use text + table + chart together for comprehensive answers

COMPUTATIONS YOU CAN PERFORM:
- Count entities (e.g., "how many firms by type")
- Sum, average, min, max of numeric fields
- Percentage calculations (e.g., "what % of tasks are completed")
- Group by fields (e.g., "contacts by firm")
- Performance calculations (total return, annualized return, volatility, growth of $100)
Use the JSON DATA section from the context to perform computations and create tables/charts.

CHART DATA FORMAT:
For charts, provide data as an array of objects. Examples:
- Bar chart of firms by type: data=[{"label":"Investment Manager","count":10},...], x_key="label", y_key="count"
- Line chart of growth: data=[{"month":"2023-01","value":100.5},...], x_key="month", y_key="value"
- Pie chart of task status: data=[{"label":"Completed","count":3},...], x_key="label", y_key="count"

TABLE DATA FORMAT:
For tables, provide headers as array of strings and rows as array of arrays of strings. ALL cell values must be strings (convert numbers to strings).

GUIDELINES:
1. Be specific and reference actual data from the context
2. When showing lists of entities, use tables with relevant columns
3. When showing distributions or comparisons, use charts
4. For analytical questions, compute metrics and present results in tables/charts
5. Always include a text explanation alongside tables and charts
6. Keep table cell values concise (truncate long text to ~40 chars)
7. Ask clarifying questions when requests are ambiguous
8. When the user asks to "show all" of something, present it as a table
9. When the user asks for a summary/overview, use text + a summary table + distribution charts
10. For performance data, use line charts for growth trends and tables for metrics`;
};

// ─── Context builder ───
export const buildToolContext = async (userQuery) => {
  try {
    const q = userQuery.toLowerCase();

    // Detect request types
    const isOverview = /overview|summarize|summary|everything|all data|database summary|dashboard|show everything/i.test(q);
    const isShowAllFirms = /all firms|every firm|list firms|show firms\b/i.test(q);
    const isShowAllContacts = /all contacts|every contact|list contacts|show contacts\b/i.test(q);
    const isShowAllProducts = /all products|every product|list products|show products\b/i.test(q);
    const isShowAllTasks = /all tasks|every task|list tasks|show tasks\b/i.test(q);
    const isShowAllActivities = /all activities|every activity|list activities|show activities\b/i.test(q);
    const isShowAllPortfolios = /all portfolios|every portfolio|list portfolios|show portfolios\b/i.test(q);
    const isShowAllBenchmarks = /all benchmarks|every benchmark|list benchmarks|show benchmarks\b/i.test(q);
    const isShowAllAnalyses = /all analyses|every analysis|list analyses|show analyses\b/i.test(q);
    const isChartRequest = /chart|graph|visualize|plot|distribution|breakdown|by type|by status|by category|pie|bar chart|line chart/i.test(q);
    const isPerformanceRequest = /performance|return|growth|compare|analytics|calculate|metric|ytd|mtd|qtd|annualized|volatility/i.test(q);

    const shouldFetchAll = isOverview || isChartRequest;
    const shouldFetchFirms = isShowAllFirms || shouldFetchAll || /firm|company|manager|allocator|consultant|brokerage/i.test(q);
    const shouldFetchContacts = isShowAllContacts || shouldFetchAll || /contact|person|people|employee/i.test(q);
    const shouldFetchProducts = isShowAllProducts || shouldFetchAll || isPerformanceRequest || /product|fund/i.test(q);
    const shouldFetchPortfolios = isShowAllPortfolios || shouldFetchAll || /portfolio/i.test(q);
    const shouldFetchBenchmarks = isShowAllBenchmarks || shouldFetchAll || isPerformanceRequest || /benchmark|index/i.test(q);
    const shouldFetchTasks = isShowAllTasks || shouldFetchAll || /task|follow.?up|assignment/i.test(q);
    const shouldFetchActivities = isShowAllActivities || shouldFetchAll || /activity|call|email|meeting|log/i.test(q);
    const shouldFetchAnalyses = isShowAllAnalyses || shouldFetchAll || /analysis|analyses/i.test(q);
    const shouldFetchPerformance = isPerformanceRequest || /return|growth|performance/i.test(q);

    const limit = shouldFetchAll ? 50 : 25;

    // Fetch data in parallel
    const [
      firms, contacts, products, portfolios, benchmarks,
      tasks, activities, analyses, returnSeries
    ] = await Promise.all([
      shouldFetchFirms ? base44.entities.Firm.list(null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchContacts ? base44.entities.Contact.list(null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchProducts ? base44.entities.Product.list(null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchPortfolios ? base44.entities.Portfolio.list(null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchBenchmarks ? base44.entities.Benchmark.filter({ deleted_at: { $exists: false } }, null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchTasks ? base44.entities.FollowUpTask.filter({ deleted_at: { $exists: false } }, null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchActivities ? base44.entities.ContactActivity.filter({ deleted_at: { $exists: false } }, null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchAnalyses ? base44.entities.Analysis.filter({ deleted_at: { $exists: false } }, null, 500).catch(() => []) : Promise.resolve([]),
      shouldFetchPerformance ? base44.entities.ReturnSeries.filter({ deleted_at: { $exists: false } }, null, 500).catch(() => []) : Promise.resolve([]),
    ]);

    // Filter active records
    const activeFirms = firms.filter((f) => !f.deleted_at);
    const activeContacts = contacts.filter((c) => !c.deleted_at);
    const activeProducts = products.filter((p) => !p.deleted_at);
    const activePortfolios = portfolios.filter((p) => !p.deleted_at);
    const activeTasks = tasks.filter((t) => !t.deleted_at);

    // Compute distributions
    const firmsByType = computeDistribution(activeFirms, (f) => f.firm_types || [f.firm_type || "Unknown"]);
    const tasksByStatus = computeDistribution(activeTasks, (t) => [t.status || "Unknown"]);
    const activitiesByType = computeDistribution(activities, (a) => [a.activity_type || "Unknown"]);
    const productsByAssetClass = computeDistribution(activeProducts, (p) => [p.asset_class || "Unknown"]);
    const contactsByType = computeDistribution(activeContacts, (c) => {
      if (Array.isArray(c.contact_type)) return c.contact_type.length > 0 ? c.contact_type : ["Unknown"];
      return [c.contact_type || "Unknown"];
    });

    // Build JSON data payload
    const jsonData = {
      counts: {
        firms: activeFirms.length,
        contacts: activeContacts.length,
        products: activeProducts.length,
        portfolios: activePortfolios.length,
        benchmarks: benchmarks.length,
        tasks: activeTasks.length,
        activities: activities.length,
        analyses: analyses.length,
      },
      distributions: {
        firms_by_type: firmsByType,
        tasks_by_status: tasksByStatus,
        activities_by_type: activitiesByType,
        products_by_asset_class: productsByAssetClass,
        contacts_by_type: contactsByType,
      },
    };

    // Add entity data
    if (shouldFetchFirms) jsonData.firms = activeFirms.slice(0, limit).map(simplifyFirm);
    if (shouldFetchContacts) jsonData.contacts = activeContacts.slice(0, limit).map(simplifyContact);
    if (shouldFetchProducts) jsonData.products = activeProducts.slice(0, limit).map(simplifyProduct);
    if (shouldFetchPortfolios) jsonData.portfolios = activePortfolios.slice(0, limit).map(simplifyPortfolio);
    if (shouldFetchBenchmarks) jsonData.benchmarks = benchmarks.slice(0, limit).map(simplifyBenchmark);
    if (shouldFetchTasks) jsonData.tasks = activeTasks.slice(0, limit).map(simplifyTask);
    if (shouldFetchActivities) jsonData.activities = activities.slice(0, limit).map(simplifyActivity);
    if (shouldFetchAnalyses) jsonData.analyses = analyses.slice(0, limit).map(simplifyAnalysis);

    // Add performance data
    if (shouldFetchPerformance) {
      const performanceData = [];

      // Products with return series
      for (const p of activeProducts.slice(0, 10)) {
        const rs = returnSeries.find((r) => r.product_id === p.id);
        if (rs && rs.monthly_returns?.length > 0) {
          const metrics = calculatePerformanceMetrics(rs.monthly_returns);
          const growthData = sampleGrowth(calculateGrowthOf100(rs.monthly_returns));
          performanceData.push({
            name: p.name,
            type: "product",
            return_type: rs.return_types?.join(", ") || "",
            start_date: rs.start_date || "",
            end_date: rs.end_date || "",
            periods: metrics?.periods || 0,
            total_return: metrics?.totalReturn || "0",
            annualized_return: metrics?.annualizedReturn || "0",
            volatility: metrics?.volatility || "0",
            growth_data: growthData,
          });
        }
      }

      // Benchmarks with returns
      for (const b of benchmarks.slice(0, 5)) {
        if (b.monthly_returns?.length > 0) {
          const metrics = calculatePerformanceMetrics(b.monthly_returns);
          const growthData = sampleGrowth(calculateGrowthOf100(b.monthly_returns));
          performanceData.push({
            name: b.name,
            type: "benchmark",
            periods: metrics?.periods || 0,
            total_return: metrics?.totalReturn || "0",
            annualized_return: metrics?.annualizedReturn || "0",
            volatility: metrics?.volatility || "0",
            growth_data: growthData,
          });
        }
      }

      if (performanceData.length > 0) {
        jsonData.performance = performanceData;
      }
    }

    // Build text context
    let context = "\n=== DATABASE OVERVIEW ===\n";
    context += `Firms: ${jsonData.counts.firms} | Contacts: ${jsonData.counts.contacts} | Products: ${jsonData.counts.products} | Portfolios: ${jsonData.counts.portfolios} | Benchmarks: ${jsonData.counts.benchmarks} | Tasks: ${jsonData.counts.tasks} | Activities: ${jsonData.counts.activities} | Analyses: ${jsonData.counts.analyses}\n`;

    context += "\n=== DISTRIBUTIONS ===\n";
    context += `Firms by type: ${firmsByType.map((d) => `${d.label} (${d.count})`).join(", ")}\n`;
    context += `Tasks by status: ${tasksByStatus.map((d) => `${d.label} (${d.count})`).join(", ")}\n`;
    context += `Activities by type: ${activitiesByType.map((d) => `${d.label} (${d.count})`).join(", ")}\n`;
    context += `Products by asset class: ${productsByAssetClass.map((d) => `${d.label} (${d.count})`).join(", ")}\n`;
    context += `Contacts by type: ${contactsByType.map((d) => `${d.label} (${d.count})`).join(", ")}\n`;

    if (jsonData.performance) {
      context += "\n=== PERFORMANCE DATA ===\n";
      jsonData.performance.forEach((p) => {
        context += `${p.name} (${p.type}): Total Return: ${p.total_return}%, Annualized: ${p.annualized_return}%, Volatility: ${p.volatility}%, Periods: ${p.periods}\n`;
      });
    }

    context += "\n=== JSON DATA (use this for creating tables and charts) ===\n";
    context += JSON.stringify(jsonData);

    return context;
  } catch (error) {
    console.error("Error building context:", error);
    return "\nUnable to retrieve current data.";
  }
};