import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MixerHorizontalIcon, ResetIcon } from '@radix-ui/react-icons';
import { Table } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
}

interface SortableColumnItemProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SortableColumnItem({ id, label, checked, onCheckedChange }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-card flex items-center gap-2 rounded-md border px-2 py-1.5 ${
        isDragging ? 'ring-primary/20 relative z-50 shadow-xl ring-2' : 'hover:border-primary/20'
      }`}
    >
      <div
        className='text-muted-foreground hover:text-foreground flex cursor-grab items-center px-1 active:cursor-grabbing'
        {...attributes}
        {...listeners}
      >
        <GripVertical className='h-3.5 w-3.5' />
      </div>
      <label className='flex min-w-0 flex-1 cursor-pointer items-center gap-2'>
        <Checkbox checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
        <span className='text-foreground truncate text-sm'>{label}</span>
      </label>
    </div>
  );
}

export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Default column order (full): all leaf columns in their definition order
  const defaultOrder = useMemo(() => table.getAllLeafColumns().map((c) => c.id), [table]);

  // Currently-active column order in the table (may be empty before hydration)
  const activeOrder = table.getState().columnOrder;
  const currentFullOrder = activeOrder.length > 0 ? activeOrder : defaultOrder;

  // Columns shown in the dialog: hideable data/details columns, sorted by
  // current table order. Pinned (non-hideable) columns stay in place.
  const sortableColumns = useMemo(() => {
    const allColumns = table.getAllLeafColumns();
    const sortable = allColumns.filter((column) => {
      const accessorKey = column.columnDef.accessorKey;
      const isDataColumn = typeof column.accessorFn !== 'undefined' || typeof accessorKey !== 'undefined';
      const isDetailsColumn = column.id === 'details' || column.id === 'detail';
      return (isDataColumn || isDetailsColumn) && column.getCanHide();
    });
    // Sort sortable columns by their index in the current full order
    return [...sortable].sort((a, b) => {
      const ia = currentFullOrder.indexOf(a.id);
      const ib = currentFullOrder.indexOf(b.id);
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, currentFullOrder]);

  // Reorder a sub-sequence of sortable columns within the full order, leaving
  // pinned columns (non-hideable) untouched.
  const reorderFullOrder = (sortableIds: string[], oldIndex: number, newIndex: number): string[] => {
    const newSortableOrder = arrayMove(sortableIds, oldIndex, newIndex);
    const sortableSet = new Set(newSortableOrder);
    const sortableCursor = { i: 0 };
    return currentFullOrder.map((id) => (sortableSet.has(id) ? newSortableOrder[sortableCursor.i++] : id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const sortableIds = sortableColumns.map((column) => column.id);
    const oldIndex = sortableIds.indexOf(String(active.id));
    const newIndex = sortableIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    table.setColumnOrder(reorderFullOrder(sortableIds, oldIndex, newIndex));
  };

  const handleResetOrder = () => {
    table.setColumnOrder(defaultOrder);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant='outline' size='sm' className='h-8'>
          <MixerHorizontalIcon className='mr-2 h-4 w-4' />
          {t('common.view')}
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{t('common.toggleColumns')}</DialogTitle>
          <DialogDescription>{t('common.dragToReorder')}</DialogDescription>
        </DialogHeader>
        <div className='max-h-[50vh] overflow-y-auto pr-1'>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
              <div className='space-y-1'>
                {sortableColumns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    id={column.id}
                    label={t(`requests.columns.${column.id === 'modelID' ? 'modelId' : column.id}`, {
                      defaultValue: t(`common.columns.${column.id}`),
                    })}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(value)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <DialogFooter className='flex flex-row items-center justify-between gap-2'>
          <Button variant='ghost' size='sm' onClick={handleResetOrder}>
            <ResetIcon className='mr-2 h-4 w-4' />
            {t('common.resetOrder')}
          </Button>
          <Button variant='outline' size='sm' onClick={() => setOpen(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
