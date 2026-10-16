'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useTheme } from '@/hooks/useTheme';

interface Task {
  id: string;
  title: string;
  status: string;
  // Add other necessary fields
}

interface KanbanBoardProps {
  tasks: Task[];
  onStatusChange: (taskId: string, newStatus: string) => void;
}

const statuses = ['Pendente', 'Em Andamento', 'Concluída'];

export function KanbanBoard({ tasks, onStatusChange }: KanbanBoardProps) {
  const { isDarkMode } = useTheme();

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    onStatusChange(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <Droppable key={status} droppableId={status}>
            {(provided, snapshot) => (
                <div
                {...provided.droppableProps}
                ref={provided.innerRef}
                className={`w-72 p-4 rounded-2xl transition-colors ${
                  isDarkMode ? 'bg-slate-900/50 border border-slate-800' : 'bg-slate-100'
                } ${snapshot.isDraggingOver ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
                    {status}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tasks.filter(t => t.status === status).length}
                  </span>
                </div>
                <div className="space-y-3 min-h-[100px]">
                  {tasks
                    .filter((task) => task.status === status)
                    .map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`p-4 rounded-xl shadow-sm border transition-all ${
                              isDarkMode 
                                ? 'bg-slate-800 border-slate-700 text-slate-100 hover:border-slate-600' 
                                : 'bg-white border-slate-200 text-slate-900 hover:border-slate-300'
                            } ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500/50 scale-[1.02]' : ''}`}
                          >
                            <div className="font-medium mb-1">{task.title}</div>
                            <div className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                              ID: {task.id.slice(0, 8)}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
