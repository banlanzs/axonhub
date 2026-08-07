import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, DoubleArrowLeftIcon, DoubleArrowRightIcon } from '@radix-ui/react-icons';
import { Layers, Copy, Check, Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChunkItem } from './chunk-item';
import { useRequestResponseChunks } from '../data/requests';

interface ChunksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, fetches chunks from server with pagination (request-level). */
  requestId?: string;
  /** Direct chunks array (for execution-level chunks or live preview). */
  chunks?: any[];
  title?: string;
  isLive?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];
const DEFAULT_PAGE_SIZE = 20;

export function ChunksDialog({ open, onOpenChange, requestId, chunks, title, isLive }: ChunksDialogProps) {
  const { t } = useTranslation();
  const [chunksPage, setChunksPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pageInputValue, setPageInputValue] = useState('1');
  const [copied, setCopied] = useState(false);
  const chunksPageRef = useRef(chunksPage);

  // Server-side (request-level) pagination
  const serverMode = !!requestId;
  const offset = (chunksPage - 1) * pageSize;
  const { data: serverPage, isLoading: isServerLoading, isFetching } = useRequestResponseChunks(
    requestId || '',
    { first: pageSize, offset },
    { enabled: serverMode && open }
  );

  // Keep ref in sync so live auto-scroll can read the current page
  useEffect(() => {
    chunksPageRef.current = chunksPage;
  }, [chunksPage]);

  // Resolved data to render: server page items, or client slice of the passed array.
  const pageChunks = serverMode ? (serverPage?.items ?? []) : (chunks ?? []).slice(offset, offset + pageSize);
  // Total chunk count for header + pagination.
  const totalChunks = serverMode ? (serverPage?.totalCount ?? 0) : (chunks?.length ?? 0);
  const totalChunksPages = serverMode
    ? Math.max(1, Math.ceil((serverPage?.totalCount ?? 0) / pageSize))
    : Math.max(1, Math.ceil((chunks?.length ?? 0) / pageSize));

  // In server mode only the current page is in memory; copy/download the loaded window.
  const loadedChunksForCopy = serverMode ? (pageChunks ?? []) : (chunks ?? []).slice(0, (chunksPage - 1) * pageSize + pageSize);

  const handleCopyAll = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(loadedChunksForCopy, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleDownloadAll = () => {
    try {
      const blob = new Blob([JSON.stringify(loadedChunksForCopy, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chunks-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  const handleChunksPageChange = useCallback((newPage: number) => {
    setChunksPage(newPage);
    setPageInputValue(String(newPage));
  }, []);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setChunksPage(1);
    setPageInputValue('1');
  }, []);

  const handlePageInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value);
  }, []);

  const handlePageInputBlur = useCallback(() => {
    const page = parseInt(pageInputValue, 10);
    if (!isNaN(page) && page >= 1 && page <= totalChunksPages) {
      setChunksPage(page);
    } else {
      setPageInputValue(String(chunksPage));
    }
  }, [pageInputValue, totalChunksPages, chunksPage]);

  const handlePageInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePageInputBlur();
    }
  }, [handlePageInputBlur]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[80vh] flex-col sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <Layers className='h-5 w-5' />
            {title || t('requests.dialogs.jsonViewer.responseChunks')}
            {isLive && (
              <Badge variant='secondary' className='ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'>
                <span className='mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green-500' />
                Live
              </Badge>
            )}
            <Badge variant='secondary' className='ml-2'>
              {(serverMode && isFetching) ? '…' : totalChunks} {t('requests.columns.responseChunks')}
            </Badge>
            <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleCopyAll}>
              {copied ? <Check className='h-4 w-4 text-green-500' /> : <Copy className='h-4 w-4' />}
            </Button>
            <Button variant='ghost' size='icon' className='h-8 w-8' onClick={handleDownloadAll}>
              <Download className='h-4 w-4' />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {isServerLoading ? (
          <div className='flex h-full min-h-[200px] items-center justify-center'>
            <Loader2 className='h-6 w-6 animate-spin' />
          </div>
        ) : pageChunks.length > 0 ? (
          <>
            <div className='bg-muted/20 w-full flex-1 overflow-auto rounded-lg border p-4'>
              <div className='space-y-4'>
                {pageChunks.map((chunk, index) => (
                  <ChunkItem
                    key={(chunksPage - 1) * pageSize + index}
                    chunk={chunk}
                    index={offset + index}
                  />
                ))}
              </div>
            </div>

            {totalChunksPages > 1 && (
              <div className='flex items-center justify-between border-t pt-4'>
                <div className='text-muted-foreground flex-1 text-sm'>
                  {t('pagination.showing', {
                    start: (chunksPage - 1) * pageSize + 1,
                    end: Math.min(chunksPage * pageSize, totalChunks),
                    total: totalChunks,
                  })}
                </div>
                <div className='flex items-center space-x-6'>
                  <div className='flex items-center space-x-2'>
                    <p className='text-sm font-medium'>{t('pagination.rowsPerPage')}</p>
                    <Select value={`${pageSize}`} onValueChange={(value) => handlePageSizeChange(Number(value))}>
                      <SelectTrigger className='h-8 w-[70px]'>
                        <SelectValue placeholder={pageSize} />
                      </SelectTrigger>
                      <SelectContent side='top'>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={`${size}`}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Input
                      className='h-8 w-12 text-center'
                      value={pageInputValue}
                      onChange={handlePageInputChange}
                      onBlur={handlePageInputBlur}
                      onKeyDown={handlePageInputKeyDown}
                    />
                    <span className='text-muted-foreground text-sm'>/ {totalChunksPages}</span>
                  </div>
                  <div className='flex items-center space-x-2'>
                    <Button variant='outline' className='h-8 w-8 p-0' onClick={() => handleChunksPageChange(1)} disabled={chunksPage === 1}>
                      <span className='sr-only'>{t('pagination.firstPage')}</span>
                      <DoubleArrowLeftIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' className='h-8 w-8 p-0' onClick={() => handleChunksPageChange(chunksPage - 1)} disabled={chunksPage === 1}>
                      <span className='sr-only'>{t('pagination.previousPage')}</span>
                      <ChevronLeftIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' className='h-8 w-8 p-0' onClick={() => handleChunksPageChange(chunksPage + 1)} disabled={chunksPage === totalChunksPages}>
                      <span className='sr-only'>{t('pagination.nextPage')}</span>
                      <ChevronRightIcon className='h-4 w-4' />
                    </Button>
                    <Button variant='outline' className='h-8 w-8 p-0' onClick={() => handleChunksPageChange(totalChunksPages)} disabled={chunksPage === totalChunksPages}>
                      <span className='sr-only'>{t('pagination.lastPage')}</span>
                      <DoubleArrowRightIcon className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className='flex h-full min-h-[200px] items-center justify-center'>
            <div className='space-y-3 text-center'>
              <Layers className='text-muted-foreground mx-auto h-12 w-12' />
              <p className='text-muted-foreground text-base'>{t('requests.detail.noResponse')}</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}