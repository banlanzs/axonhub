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

  // Columns shown in the dialog: data columns + details column, in current display order
  const sortableColumns = useMemo(() => {
    const columns = table.getAllLeafColumns().filter((column) => {
      const accessorKey = column.columnDef.accessorKey;
      const isDataColumn = typeof column.accessorFn !== 'undefined' || typeof accessorKey !== 'undefined';
      const isDetailsColumn = column.id === 'details' || column.id === 'detail';
      return (isDataColumn || isDetailsColumn) && column.getCanHide();
    });
    const order = table.getState().columnOrder;
    if (order.length > 0) {
      const ordered = [...columns].sort((a, b) => {
        const ia = order.indexOf(a.id);
        const ib = order.indexOf(b.id);
        return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
      });
      return ordered;
    }
    return columns;
  }, [table]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = sortableColumns.map((column) => column.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    table.setColumnOrder(arrayMove(ids, oldIndex, newIndex));
  };

  const handleResetOrder = () => {
    table.setColumnOrder(
      table
        .getAllLeafColumns()
        .filter((column) => (typeof column.accessorFn !== 'undefined' || typeof column.columnDef.accessorKey !== 'undefined' || column.id === 'details' || column.id === 'detail') && column.getCanHide())
        .map((column) => column.id)
    );
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
