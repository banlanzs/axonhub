'use client';

import { ColumnDef, Row, Table } from '@tanstack/react-table';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import LongText from '@/components/long-text';
import { User } from '../data/schema';
import { DataTableRowActions } from './data-table-row-actions';

const IsOwnerCell = memo(function IsOwnerCell({ row }: { row: Row<User> }) {
  const { t } = useTranslation();
  const isOwner = row.getValue('isOwner') as boolean;
  return isOwner ? (
    <Badge variant='default'>{t('users.badges.owner')}</Badge>
  ) : (
    <Badge variant='secondary'>{t('users.badges.user')}</Badge>
  );
});
IsOwnerCell.displayName = 'IsOwnerCell';

const RolesCell = memo(function RolesCell({ row }: { row: Row<User> }) {
  const { t } = useTranslation();
  const user = row.original;
  const roles = user.roles?.edges?.map((edge) => edge.node);
  if (!roles || roles.length === 0) {
    return <span className='text-muted-foreground'>{t('users.badges.noRoles')}</span>;
  }
  return (
    <div className='flex flex-wrap gap-1'>
      {roles.map((role) => (
        <Badge key={role.id} variant='outline'>
          {role.name}
        </Badge>
      ))}
    </div>
  );
});
RolesCell.displayName = 'RolesCell';

const StatusCell = memo(function StatusCell({ row }: { row: Row<User> }) {
  const { t } = useTranslation();
  const status = row.getValue('status') as string;
  return (
    <Badge variant={status === 'activated' ? 'default' : 'secondary'}>
      {status === 'activated' ? t('users.status.activated') : t('users.status.deactivated')}
    </Badge>
  );
});
StatusCell.displayName = 'StatusCell';

const CreatedAtCell = memo(function CreatedAtCell({ row }: { row: Row<User> }) {
  const date = new Date(row.getValue('createdAt'));
  return <>{date.toLocaleDateString()}</>;
});
CreatedAtCell.displayName = 'CreatedAtCell';

const UpdatedAtCell = memo(function UpdatedAtCell({ row }: { row: Row<User> }) {
  const date = new Date(row.getValue('updatedAt'));
  return <>{date.toLocaleDateString()}</>;
});
UpdatedAtCell.displayName = 'UpdatedAtCell';

export const createColumns = (t: ReturnType<typeof useTranslation>['t'], canWrite: boolean = false): ColumnDef<User>[] => {
  const columns: ColumnDef<User>[] = [];

  // Only show select column if user has write permissions (for potential bulk operations)
  if (canWrite) {
    columns.push({
      id: 'select',
      header: ({ table }: { table: Table<User> }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      ),
      cell: ({ row }: { row: Row<User> }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(value) => row.toggleSelected(!!value)} aria-label='Select row' />
      ),
      enableSorting: false,
      enableHiding: false,
    });
  }

  // Add other columns
  columns.push(
    {
      accessorKey: 'firstName',
      header: t('users.columns.firstName'),
      cell: ({ row }) => <LongText>{row.getValue('firstName')}</LongText>,
    },
    {
      accessorKey: 'lastName',
      header: t('users.columns.lastName'),
      cell: ({ row }) => <LongText>{row.getValue('lastName')}</LongText>,
    },
    {
      accessorKey: 'email',
      header: t('users.columns.email'),
      cell: ({ row }) => <LongText>{row.getValue('email')}</LongText>,
    },
    {
      accessorKey: 'isOwner',
      header: t('users.columns.owner'),
      cell: ({ row }) => <IsOwnerCell row={row} />,
    },
    {
      accessorKey: 'roles',
      header: t('users.columns.roles'),
      cell: ({ row }) => <RolesCell row={row} />,
    },
    {
      accessorKey: 'status',
      header: t('common.columns.status'),
      cell: ({ row }) => <StatusCell row={row} />,
    },
    {
      accessorKey: 'createdAt',
      header: t('common.columns.createdAt'),
      cell: ({ row }) => <CreatedAtCell row={row} />,
    },
    {
      accessorKey: 'updatedAt',
      header: t('common.columns.updatedAt'),
      cell: ({ row }) => <UpdatedAtCell row={row} />,
    },
    {
      id: 'actions',
      header: t('common.columns.actions'),
      cell: ({ row }) => <DataTableRowActions row={row} />,
    }
  );

  return columns;
};
