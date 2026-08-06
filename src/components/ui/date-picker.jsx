import React, { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Reusable calendar-based date picker using the app's Calendar + Popover components.
 * - Value is an ISO date string (YYYY-MM-DD).
 * - Displays in MM/DD/YYYY format.
 * - Defaults to today when no value is provided (unless allowEmpty=true).
 */
export default function DatePicker({ value, onChange, placeholder = "MM/DD/YYYY", allowEmpty = false, className }) {
  const [open, setOpen] = useState(false);

  const selectedDate = value ? new Date(value + "T00:00:00") : undefined;
  const displayText = selectedDate ? format(selectedDate, "MM/dd/yyyy") : placeholder;

  const handleSelect = (date) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    } else if (allowEmpty) {
      onChange("");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !selectedDate && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="w-4 h-4 opacity-70" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}