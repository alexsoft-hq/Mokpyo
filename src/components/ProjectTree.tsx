import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '@/types/goal';
import {
  DndContext,
  DragOverlay,
  rectIntersection,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FileText,
  GripVertical,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { getProjectAndDescendantIds } from '@/lib/projectTree';

// 커스텀 충돌 감지: 포인터 기반으로 모두 처리
const customCollisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);

  // 루트 영역이 감지되면 우선
  const rootCollision = collisions.find(c => c.id === 'root');
  if (rootCollision) {
    return [rootCollision];
  }

  // 그 외에는 모든 충돌 반환
  return collisions;
};

interface ProjectTreeProps {
  projects: Project[];  // flat list
  projectTree: Project[];  // hierarchical tree
  selectedId: string | null;
  onSelect: (project: Project) => void;
  onMove: (projectId: string, newParentId: string | null) => Promise<void>;
  onCreateNew: () => void;
}

interface TreeNodeProps {
  project: Project;
  depth: number;
  expandedIds: Set<string>;
  selectedId: string | null;
  draggedId: string | null;
  dropTargetId: string | null;
  isAnyDragging: boolean;
  onToggle: (id: string) => void;
  onSelect: (project: Project) => void;
  allProjects: Project[];
}

function TreeNodeContent({
  project,
  depth,
  isExpanded,
  isSelected,
  isDragging,
  isDropTarget,
  hasChildren,
  isAnyDragging,
  onToggle,
  onSelect,
}: {
  project: Project;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  hasChildren: boolean;
  isAnyDragging: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors',
        !isAnyDragging && 'hover:bg-accent',
        isSelected && !isAnyDragging && 'bg-primary/10 text-primary',
        isDragging && 'opacity-50',
        isDropTarget && 'bg-primary/20 ring-2 ring-primary ring-inset'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onSelect}
    >
      <GripVertical className="h-3 w-3 text-muted-foreground/50 cursor-grab flex-shrink-0" />

      {hasChildren ? (
        <button
          className="p-0.5 hover:bg-accent-foreground/10 rounded flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      ) : (
        <div className="w-5" />
      )}

      {hasChildren ? (
        isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )
      ) : (
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}

      <span className="text-sm truncate flex-1">{project.name}</span>
    </div>
  );
}

function DraggableTreeNode({
  project,
  depth,
  expandedIds,
  selectedId,
  draggedId,
  dropTargetId,
  isAnyDragging,
  onToggle,
  onSelect,
  allProjects,
}: TreeNodeProps) {
  const hasChildren = project.children && project.children.length > 0;
  const isExpanded = expandedIds.has(project.id);
  const isSelected = selectedId === project.id;
  const isBeingDragged = draggedId === project.id;
  const isDropTarget = dropTargetId === project.id;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging: isDraggingThis } = useDraggable({
    id: project.id,
    data: { project },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: project.id,
    data: { project },
  });

  // Combine refs
  const setNodeRef = (node: HTMLDivElement | null) => {
    setDragRef(node);
    setDropRef(node);
  };

  return (
    <div>
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(
          'transition-opacity duration-150',
          isDraggingThis && 'opacity-30'
        )}
      >
        <TreeNodeContent
          project={project}
          depth={depth}
          isExpanded={isExpanded}
          isSelected={isSelected}
          isDragging={isBeingDragged}
          isDropTarget={isOver || isDropTarget}
          hasChildren={hasChildren}
          isAnyDragging={isAnyDragging}
          onToggle={() => onToggle(project.id)}
          onSelect={() => onSelect(project)}
        />
      </div>

      {hasChildren && isExpanded && (
        <div>
          {project.children!.map((child) => (
            <DraggableTreeNode
              key={child.id}
              project={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              selectedId={selectedId}
              draggedId={draggedId}
              dropTargetId={dropTargetId}
              isAnyDragging={isAnyDragging}
              onToggle={onToggle}
              onSelect={onSelect}
              allProjects={allProjects}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectTree({
  projects,
  projectTree,
  selectedId,
  onSelect,
  onMove,
  onCreateNew,
}: ProjectTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    // 기본적으로 모든 프로젝트를 펼침
    const ids = new Set<string>();
    projects.forEach(p => ids.add(p.id));
    return ids;
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isOverRootManual, setIsOverRootManual] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // 드래그 중인 프로젝트와 그 자손들의 ID 목록
  const draggedDescendantIds = useMemo(() => {
    if (!draggedId) return new Set<string>();
    const draggedProject = projects.find(p => p.id === draggedId);
    if (!draggedProject) return new Set<string>();
    return new Set(getProjectAndDescendantIds(draggedProject));
  }, [draggedId, projects]);

  const handleToggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id as string | null;

    // 자기 자신이나 자손에게는 드롭 불가
    if (overId && draggedDescendantIds.has(overId)) {
      setDropTargetId(null);
      return;
    }

    setDropTargetId(overId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setDraggedId(null);
    setDropTargetId(null);

    if (!over) return;

    const draggedProjectId = active.id as string;
    const targetProjectId = over.id as string;

    // 자기 자신에게 드롭하면 무시
    if (draggedProjectId === targetProjectId) return;

    // 자손에게 드롭하면 무시 (순환 참조 방지)
    if (draggedDescendantIds.has(targetProjectId)) return;

    // 부모 변경 API 호출
    await onMove(draggedProjectId, targetProjectId);
  };

  const handleDragCancel = () => {
    setDraggedId(null);
    setDropTargetId(null);
    setIsOverRootManual(false);
  };

  const handleRootDrop = async (draggedProjectId: string) => {
    setDraggedId(null);
    setDropTargetId(null);
    setIsOverRootManual(false);

    if (draggedProjectId) {
      await onMove(draggedProjectId, null);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => {
          const draggedProjectId = event.active.id as string;
          if (isOverRootManual) {
            handleRootDrop(draggedProjectId);
          } else {
            handleDragEnd(event);
          }
        }}
        onDragCancel={handleDragCancel}
      >
        {/* 루트 드롭 영역 - 마우스 이벤트로 직접 추적 */}
        <div
          className={cn(
            'mx-2 mt-2 rounded-md border-2 border-dashed transition-all flex items-center justify-center relative z-10',
            draggedId
              ? isOverRootManual
                ? 'p-3 min-h-[44px] border-primary bg-primary/20 text-primary ring-2 ring-primary'
                : 'p-3 min-h-[44px] border-muted-foreground/50 text-muted-foreground bg-muted/30'
              : 'p-1 min-h-[28px] border-muted/30 text-muted-foreground/50'
          )}
          onMouseEnter={() => draggedId && setIsOverRootManual(true)}
          onMouseLeave={() => setIsOverRootManual(false)}
        >
          <div className={cn(
            'text-center font-medium transition-all pointer-events-none',
            draggedId ? 'text-sm' : 'text-xs'
          )}>
            {draggedId
              ? (isOverRootManual ? '✓ 여기에 놓으면 최상위로 이동' : '⬆️ 최상위로 이동')
              : '최상위'
            }
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {projectTree.map((project) => (
            <DraggableTreeNode
              key={project.id}
              project={project}
              depth={0}
              expandedIds={expandedIds}
              selectedId={selectedId}
              draggedId={draggedId}
              dropTargetId={dropTargetId}
              isAnyDragging={!!draggedId}
              onToggle={handleToggle}
              onSelect={onSelect}
              allProjects={projects}
            />
          ))}

          {projectTree.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              프로젝트가 없습니다.
            </div>
          )}
        </div>

        {/* DragOverlay를 Portal로 document.body에 렌더링하여 Dialog transform 영향 제거 */}
        {createPortal(
          <DragOverlay
            dropAnimation={null}
            style={{ cursor: 'grabbing' }}
          >
            {draggedId && (() => {
              const project = projects.find(p => p.id === draggedId);
              if (!project) return null;
              return (
                <div
                  className="bg-background border rounded-md shadow-xl px-3 py-2 flex items-center gap-2 pointer-events-none"
                  style={{ transform: 'translate(-8px, -8px)' }}
                >
                  <Folder className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">{project.name}</span>
                </div>
              );
            })()}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      <div className="p-2 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onCreateNew}
        >
          <Plus className="h-4 w-4 mr-2" />
          새 프로젝트
        </Button>
      </div>
    </div>
  );
}
