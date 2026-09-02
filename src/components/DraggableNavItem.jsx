import React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/**
 * A single draggable navigation header item.
 * Renders either a DropdownMenu (when `submenu` is present) or a plain button.
 * Wrapped in a Draggable so the user can reorder it via drag-and-drop.
 */
export default function DraggableNavItem({ item, index }) {
  const { label, icon: NavIcon, onClick, submenu } = item;

  return (
    <Draggable draggableId={label} index={index}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="flex"
        >
          {submenu ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  title={label}
                  className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white/15 transition-colors group"
                >
                  <div className="relative">
                    <NavIcon className="w-4 h-4 text-white/80 group-hover:text-white" />
                    <ChevronDown className="w-2.5 h-2.5 text-white/50 group-hover:text-white absolute -bottom-1 -right-1" />
                  </div>
                  <span className="text-[9px] text-white/70 group-hover:text-white font-medium leading-none">
                    {label}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="min-w-[10rem] max-h-[75vh] overflow-y-auto"
              >
                {submenu.map((sub) => {
                  const SubIcon = sub.icon;
                  return (
                    <DropdownMenuItem
                      key={sub.label}
                      onClick={sub.onClick}
                      className="gap-2 cursor-pointer"
                    >
                      <SubIcon className="w-4 h-4" />
                      <span>{sub.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => onClick && onClick()}
              title={label}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg hover:bg-white/15 transition-colors group"
            >
              <NavIcon className="w-4 h-4 text-white/80 group-hover:text-white" />
              <span className="text-[9px] text-white/70 group-hover:text-white font-medium leading-none">
                {label}
              </span>
            </button>
          )}
        </div>
      )}
    </Draggable>
  );
}