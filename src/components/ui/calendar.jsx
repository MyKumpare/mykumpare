import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function YearMonthPicker({ displayMonth, onChange }) {
  const currentYear = displayMonth.getFullYear();
  const currentMonth = displayMonth.getMonth();
  const [pickerYear, setPickerYear] = React.useState(currentYear);

  const years = [];
  for (let y = currentYear - 10; y <= currentYear + 10; y++) years.push(y);

  return (
    <div className="p-2 w-[220px]">
      {/* Year selector */}
      <div className="flex items-center justify-between mb-2">
        <button
          className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 p-0 opacity-50 hover:opacity-100")}
          onClick={() => setPickerYear(y => y - 1)}
        ><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold">{pickerYear}</span>
        <button
          className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 p-0 opacity-50 hover:opacity-100")}
          onClick={() => setPickerYear(y => y + 1)}
        ><ChevronRight className="h-4 w-4" /></button>
      </div>
      {/* Month grid */}
      <div className="grid grid-cols-3 gap-1">
        {MONTHS.map((name, idx) => {
          const isSelected = pickerYear === currentYear && idx === currentMonth;
          return (
            <button
              key={name}
              onClick={() => onChange(new Date(pickerYear, idx, 1))}
              className={cn(
                "rounded-md py-1 text-xs font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  const [showPicker, setShowPicker] = React.useState(false);
  const [month, setMonth] = React.useState(props.defaultMonth ?? props.month ?? new Date());

  // Keep in sync if controlled month changes externally
  React.useEffect(() => {
    if (props.month) setMonth(props.month);
  }, [props.month]);

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    setShowPicker(false);
    props.onMonthChange?.(newMonth);
  };

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      month={month}
      onMonthChange={handleMonthChange}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: cn(
          "text-sm font-medium cursor-pointer hover:text-primary transition-colors select-none",
        ),
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-accent [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 font-normal aria-selected:opacity-100"),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside: "day-outside text-muted-foreground aria-selected:bg-accent/50 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className: cls, ...rest }) => <ChevronLeft className={cn("h-4 w-4", cls)} {...rest} />,
        IconRight: ({ className: cls, ...rest }) => <ChevronRight className={cn("h-4 w-4", cls)} {...rest} />,
        Caption: ({ displayMonth }) => (
          <div className="flex justify-center pt-1 relative items-center w-full">
            {/* Prev month */}
            <button
              className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute left-1")}
              onClick={() => handleMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}
            ><ChevronLeft className="h-4 w-4" /></button>

            {/* Clickable label */}
            <button
              className="text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setShowPicker(p => !p)}
            >
              {MONTHS[displayMonth.getMonth()]} {displayMonth.getFullYear()}
            </button>

            {/* Next month */}
            <button
              className={cn(buttonVariants({ variant: "outline" }), "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 absolute right-1")}
              onClick={() => handleMonthChange(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}
            ><ChevronRight className="h-4 w-4" /></button>

            {/* Year/Month picker dropdown */}
            {showPicker && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-md shadow-md">
                <YearMonthPicker displayMonth={displayMonth} onChange={handleMonthChange} />
              </div>
            )}
          </div>
        ),
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar"
export { Calendar }