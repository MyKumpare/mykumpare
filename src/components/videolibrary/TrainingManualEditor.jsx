import React from "react";
import { ArrowUp, ArrowDown, Trash2, Plus, ArrowLeft, Download, GripVertical, Check, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

/**
 * Edit mode for the training manual generator.
 * Lets the user:
 *  - review/edit the title, intro, and each step's text
 *  - drag-and-drop screenshots to reorder them (step references auto-remap)
 *  - drag-and-drop steps to reorder them
 *  - change which screenshot is assigned to each step
 *  - add/remove steps
 * "Finalize" downloads the PDF with all edits applied.
 */
export default function TrainingManualEditor({ manual, onManualChange, frames, onFramesChange, onBack, onDownload }) {
  if (!manual) return null;

  const updateField = (field, value) => onManualChange({ ...manual, [field]: value });

  const updateStep = (index, patch) => {
    const steps = [...(manual.steps || [])];
    steps[index] = { ...steps[index], ...patch };
    onManualChange({ ...manual, steps });
  };

  const moveStep = (index, dir) => {
    const steps = [...(manual.steps || [])];
    const target = index + dir;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    steps.forEach((s, i) => (s.step_number = i + 1));
    onManualChange({ ...manual, steps });
  };

  const onStepDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const steps = [...(manual.steps || [])];
    const [moved] = steps.splice(result.source.index, 1);
    steps.splice(result.destination.index, 0, moved);
    steps.forEach((s, i) => (s.step_number = i + 1));
    onManualChange({ ...manual, steps });
  };

  // Reorder screenshots (frames). Builds an old→new index remap so every
  // step's screenshot_index stays pointing at the same screenshot.
  const onFrameDragEnd = (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    if (!onFramesChange) return;
    const newFrames = [...frames];
    const [moved] = newFrames.splice(result.source.index, 1);
    newFrames.splice(result.destination.index, 0, moved);

    // Map old array position → new array position for each frame object
    const remap = {};
    frames.forEach((frame, oldIdx) => {
      remap[oldIdx] = newFrames.findIndex((f) => f === frame);
    });

    const newSteps = (manual.steps || []).map((s) => ({
      ...s,
      screenshot_index: remap[s.screenshot_index ?? 0] ?? 0,
    }));

    onFramesChange(newFrames);
    onManualChange({ ...manual, steps: newSteps });
  };

  const deleteStep = (index) => {
    const steps = (manual.steps || []).filter((_, i) => i !== index);
    steps.forEach((s, i) => (s.step_number = i + 1));
    onManualChange({ ...manual, steps });
  };

  const addStep = () => {
    const steps = [...(manual.steps || [])];
    steps.push({
      step_number: steps.length + 1,
      title: "",
      screenshot_index: 0,
      instructions: "",
    });
    onManualChange({ ...manual, steps });
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between gap-2 sticky top-0 bg-white py-2 z-10">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Preview
          </Button>
          <span className="text-xs text-gray-400 hidden sm:inline">Editing — drag screenshots or steps to reorder</span>
        </div>
        <Button size="sm" onClick={onDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Check className="w-3.5 h-3.5" /> Finalize &amp; Download PDF
        </Button>
      </div>

      {/* Title + Intro */}
      <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Manual Title</label>
          <input
            type="text"
            value={manual.title || ""}
            onChange={(e) => updateField("title", e.target.value)}
            className="w-full px-3 py-2 text-sm font-semibold border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Introduction</label>
          <textarea
            value={manual.intro || ""}
            onChange={(e) => updateField("intro", e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y"
          />
        </div>
      </div>

      {/* Screenshots — drag to reorder */}
      {frames.length > 0 && (
        <div className="space-y-2 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-gray-500" /> Screenshots ({frames.length})
            </p>
            <span className="text-xs text-gray-400">Drag to reorder</span>
          </div>
          <DragDropContext onDragEnd={onFrameDragEnd}>
            <Droppable droppableId="frames" direction="horizontal">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-2 overflow-x-auto pb-2">
                  {frames.map((frame, i) => (
                    <Draggable key={`frame-${frame.index}`} draggableId={`frame-${frame.index}`} index={i}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          className={`flex-shrink-0 relative cursor-grab active:cursor-grabbing touch-none ${
                            snapshot.isDragging ? "opacity-80 ring-2 ring-emerald-400 rounded" : ""
                          }`}
                          title={`Screenshot ${i + 1} — drag to reorder`}
                        >
                          <img
                            src={frame.dataUrl}
                            alt={`Screenshot ${i + 1}`}
                            className="w-24 h-16 rounded border border-gray-200 object-cover bg-gray-100"
                          />
                          <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <GripVertical className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 text-white/70 bg-black/40 rounded p-0.5" />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      )}

      {/* Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Steps ({(manual.steps || []).length})</p>
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="w-3.5 h-3.5" /> Add Step
          </Button>
        </div>

        <DragDropContext onDragEnd={onStepDragEnd}>
          <Droppable droppableId="steps">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-3">
                {(manual.steps || []).map((step, i) => (
                  <Draggable key={`step-${i}`} draggableId={`step-${i}`} index={i}>
                    {(dragProvided, snapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`border rounded-lg overflow-hidden bg-white transition-shadow ${
                          snapshot.isDragging ? "shadow-lg border-emerald-400" : "border-gray-200"
                        }`}
                      >
                        {/* Step header */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                          <span
                            {...dragProvided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 flex-shrink-0 touch-none"
                            title="Drag to reorder"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {step.step_number}
                          </span>
                          <div className="flex-1 min-w-0">
                            <input
                              type="text"
                              value={step.title || ""}
                              onChange={(e) => updateStep(i, { title: e.target.value })}
                              placeholder="Step title…"
                              className="w-full px-2 py-1 text-sm font-semibold border border-transparent rounded hover:border-gray-300 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            />
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => moveStep(i, -1)}
                              disabled={i === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => moveStep(i, 1)}
                              disabled={i === (manual.steps || []).length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteStep(i)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Delete step"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Step body: screenshot + instructions */}
                        <div className="flex gap-3 p-3">
                          {/* Screenshot preview + selector */}
                          <div className="flex-shrink-0 w-32">
                            <img
                              src={frames[Math.max(0, Math.min(frames.length - 1, step.screenshot_index ?? 0))]?.dataUrl}
                              alt={`Step ${step.step_number}`}
                              className="w-full h-20 object-cover rounded border border-gray-200 bg-gray-50"
                            />
                            <select
                              value={step.screenshot_index ?? 0}
                              onChange={(e) => updateStep(i, { screenshot_index: parseInt(e.target.value, 10) })}
                              className="w-full mt-1.5 px-1.5 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                            >
                              {frames.map((_, fi) => (
                                <option key={fi} value={fi}>Screenshot {fi + 1}</option>
                              ))}
                            </select>
                          </div>

                          {/* Instructions */}
                          <div className="flex-1 min-w-0">
                            <textarea
                              value={step.instructions || ""}
                              onChange={(e) => updateStep(i, { instructions: e.target.value })}
                              placeholder="Step instructions…"
                              rows={4}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {(manual.steps || []).length === 0 && (
          <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
            No steps. Click "Add Step" to create one.
          </div>
        )}
      </div>
    </div>
  );
}