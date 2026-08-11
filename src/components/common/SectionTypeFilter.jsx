import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function SectionTypeFilter({ label, value, onChange, options, allLabel = "All Types" }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-700">{label}:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-auto min-w-32 text-xs gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}