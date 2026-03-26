import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, Edit2 } from "lucide-react";
import ProductReturnsManager from "./ProductReturnsManager";

function toMMDDYYYY(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

export default function ReturnSeriesDetailDialog({
  open,
  onOpenChange,
  series,
  onEdit,
  onDelete,
  onAddReturn,
  productName,
}) {
  const getSeriesName = () => {
    return series?.composite_name || series?.representative_portfolio_name || series?.paper_portfolio_name || series?.back_test_name || "Unnamed Series";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Series Details</DialogTitle>
          {productName && (
            <div className="pt-1 space-y-1">
              <p className="text-sm text-gray-500">{productName}</p>
              <p className="text-sm font-semibold text-gray-900">{getSeriesName()}</p>
            </div>
          )}
        </DialogHeader>

        {series && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                Overview
              </TabsTrigger>
              <TabsTrigger value="returns" className="flex-1">
                Returns ({series.monthly_returns?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Type
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {series.return_types?.join(", ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Name
                    </p>
                    <p className="text-sm font-semibold text-gray-900 mt-1">
                      {series.composite_name ||
                        series.paper_portfolio_name ||
                        series.back_test_name ||
                        "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Inception Date
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {toMMDDYYYY(series.inception_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Return Frequency
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {series.return_frequency}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase">
                      Data Range
                    </p>
                    <p className="text-sm text-gray-900 mt-1">
                      {toMMDDYYYY(series.start_date)} to{" "}
                      {toMMDDYYYY(series.end_date)}
                    </p>
                  </div>
                  {series.gips_status && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase">
                        GIPS Status
                      </p>
                      <p className="text-sm text-gray-900 mt-1">
                        {series.gips_status}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Returns Tab */}
             <TabsContent value="returns" className="space-y-4">
               <ProductReturnsManager
                 returns={series.monthly_returns || []}
                 onChange={(updatedReturns) => {
                   onEdit({
                     ...series,
                     monthly_returns: updatedReturns,
                   });
                 }}
                 isEditing={true}
                 inceptionDate={series.inception_date}
                 seriesName={getSeriesName()}
                 showNetReturn={series.return_frequency === "Gross and Net" || (Array.isArray(series.return_frequency) && series.return_frequency.includes("Net"))}
               />
             </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {onEdit && (
            <Button
              onClick={() => {
                onEdit(series);
                onOpenChange(false);
              }}
              className="gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              variant="outline"
            >
              <Edit2 className="w-3.5 h-3.5" /> Edit
            </Button>
          )}
          {onDelete && (
            <Button
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to delete this return series?"
                  )
                ) {
                  onDelete(series.id);
                  onOpenChange(false);
                }
              }}
              variant="outline"
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}