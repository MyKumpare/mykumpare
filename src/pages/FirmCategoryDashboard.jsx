import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2, Building2, PackageCheck, PackageX, Layers } from "lucide-react";

export default function FirmCategoryDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await base44.functions.invoke("getFirmCategorySummary", {});
        setData(response.data);
      } catch (err) {
        setError(err.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-2">
        <p className="text-destructive font-medium">Error loading dashboard</p>
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  const { summary, totals } = data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold">Firm Category Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Active vs inactive firms by category — <span className="text-green-600 font-medium">active</span> means the firm has at least one product.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Firms</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.total_firms}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active (Has Products)</CardTitle>
            <PackageCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totals.total_active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive (No Products)</CardTitle>
            <PackageX className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totals.total_inactive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Stacked bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Firms by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(300, summary.length * 45)}>
            <BarChart data={summary} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="firm_type" width={160} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => [value, name === "active_count" ? "Active" : "Inactive"]}
                labelFormatter={(label) => `Category: ${label}`}
              />
              <Legend formatter={(value) => (value === "active_count" ? "Active" : "Inactive")} />
              <Bar dataKey="active_count" name="active_count" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="inactive_count" name="inactive_count" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Summary table */}
      <Card>
        <CardHeader>
          <CardTitle>Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-3 px-2 font-medium">Category</th>
                  <th className="text-center py-3 px-2 font-medium">Active</th>
                  <th className="text-center py-3 px-2 font-medium">Inactive</th>
                  <th className="text-center py-3 px-2 font-medium">Total</th>
                  <th className="text-center py-3 px-2 font-medium">% Active</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => (
                  <tr key={row.firm_type} className="border-b hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{row.firm_type}</td>
                    <td className="text-center py-3 px-2 text-green-600 font-medium">{row.active_count}</td>
                    <td className="text-center py-3 px-2 text-red-600 font-medium">{row.inactive_count}</td>
                    <td className="text-center py-3 px-2 font-semibold">{row.total_count}</td>
                    <td className="text-center py-3 px-2">
                      {row.total_count > 0 ? Math.round((row.active_count / row.total_count) * 100) : 0}%
                    </td>
                  </tr>
                ))}
                <tr className="border-b-2 border-border font-semibold bg-muted/30">
                  <td className="py-3 px-2">Total</td>
                  <td className="text-center py-3 px-2 text-green-600">{totals.total_active}</td>
                  <td className="text-center py-3 px-2 text-red-600">{totals.total_inactive}</td>
                  <td className="text-center py-3 px-2">{totals.total_firms}</td>
                  <td className="text-center py-3 px-2">
                    {totals.total_firms > 0 ? Math.round((totals.total_active / totals.total_firms) * 100) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}