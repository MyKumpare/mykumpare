export default function SectionExpandCollapse({ onExpandAll, onCollapseAll, className = "" }) {
  return (
    <div className={`flex items-center justify-end gap-1 mb-1 ${className}`}>
      <button
        type="button"
        onClick={onExpandAll}
        className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
      >
        Expand All
      </button>
      <span className="text-gray-300">|</span>
      <button
        type="button"
        onClick={onCollapseAll}
        className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
      >
        Collapse All
      </button>
    </div>
  );
}