import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePaperSelection, PaperData } from "@/providers/PaperSelection";

// ============================================
// StepTracker Component
// ============================================

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  description?: string;
}

interface StepTrackerProps {
  steps: Step[];
}

export const StepTracker = ({ steps }: StepTrackerProps) => {
  return (
    <div className="w-xl max-w-3xl rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="text-base font-semibold text-foreground">Supervisor Agent</h3>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`group flex items-start gap-3 px-4 py-3 cursor-default transition-colors duration-150 ${
              step.status === 'running'
                ? 'bg-secondary/60 hover:bg-secondary'
                : step.status === 'error'
                ? 'hover:bg-red-950/20'
                : 'hover:bg-secondary/30'
            }`}
          >
            {/* Status icon */}
            <div className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
              {step.status === 'completed' && (
                <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {step.status === 'running' && (
                <svg className="w-5 h-5 text-indigo-400 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {step.status === 'pending' && (
                <div className="w-4 h-4 rounded-full border-2 border-border group-hover:border-muted-foreground transition-colors" />
              )}
              {step.status === 'error' && (
                <svg className="w-5 h-5 text-red-400 group-hover:text-red-300 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium leading-snug transition-colors ${
                step.status === 'running'   ? 'text-foreground' :
                step.status === 'completed' ? 'text-muted-foreground group-hover:text-foreground' :
                step.status === 'error'     ? 'text-red-400' :
                'text-muted-foreground/60 group-hover:text-muted-foreground'
              }`}>
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug group-hover:text-foreground/80 transition-colors">
                  {step.description}
                </p>
              )}
            </div>

            {/* Running indicator */}
            {step.status === 'running' && (
              <div className="flex-shrink-0 self-center">
                <span className="text-xs text-indigo-400 group-hover:text-indigo-300 transition-colors">
                  Running…
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// SubagentStatus Component
// ============================================

interface SubagentStatusProps {
  title: string;
  icon?: 'search' | 'qa';
  label: string;
  status: 'running' | 'completed';
  description?: string;
}

const SubagentIcons = {
  search: (
    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  qa: (
    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const SubagentStatus = ({ title, icon = 'search', label, status, description }: SubagentStatusProps) => (
  <div className="w-xl max-w-3xl rounded-lg border border-border bg-card shadow-sm overflow-hidden">
    {/* Header */}
    <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/30">
      {SubagentIcons[icon]}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <span className="ml-auto text-xs font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border">
        subagent
      </span>
    </div>

    {/* Single status row */}
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="flex-shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center">
        {status === 'running' ? (
          <svg className="w-5 h-5 text-indigo-400 animate-spin" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd" />
          </svg>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${status === 'running' ? 'text-foreground' : 'text-muted-foreground'}`}>
          {label}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      {status === 'running' && (
        <span className="flex-shrink-0 self-center text-xs text-indigo-400">Running…</span>
      )}
    </div>
  </div>
);

export const FinderStatus = (props: Omit<SubagentStatusProps, 'title' | 'icon'>) => (
  <SubagentStatus title="Research Agent" icon="search" {...props} />
);

export const QAStatus = (props: Omit<SubagentStatusProps, 'title' | 'icon'>) => (
  <SubagentStatus title="Q&A Agent" icon="qa" {...props} />
);

// ============================================
// Paper Components
// ============================================

interface Author {
  authorId?: string;
  name?: string;
}

interface PublicationVenue {
  name?: string;
  type?: string;
}

interface PaperComponentProps {
  paperId?: string;
  title?: string;
  authors?: Author[] | string[];
  venue?: string;
  publicationVenue?: PublicationVenue;
  publicationDate?: string;
  year?: number;
  abstract?: string;
  citationCount?: number;
  url?: string;
  isSelected?: boolean;
  onSelectChange?: (paperId: string, selected: boolean) => void;
  openAccessPdf?: { url?: string } | null;
}

interface PaperListComponentProps {
  papers: PaperComponentProps[];
}

interface IngestStatus {
  status: 'idle' | 'ingesting' | 'processing' | 'success' | 'error';
  message?: string;
  taskIds?: { paperId: string; taskId: string }[];
}

interface TaskPollStatus {
  paperId: string;
  taskId: string;
  state: 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE';
  result?: { method?: string; chunk_count?: number; success?: boolean; error?: string } | null;
}

export const PaperListComponent = (props: PaperListComponentProps) => {
  const paperCount = props.papers?.length || 0;
  const { selectPaper } = usePaperSelection();
  const [tempSelected, setTempSelected] = useState<Set<string>>(new Set()); // Temporary checkbox selections
  const [ingestStatus, setIngestStatus] = useState<IngestStatus>({ status: 'idle' });
  const [taskStatuses, setTaskStatuses] = useState<TaskPollStatus[]>([]);
  const backendApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:2024';

  // Poll task statuses until all are terminal
  useEffect(() => {
    const tasks = ingestStatus.taskIds;
    console.log('[ingest poll] useEffect fired, taskIds:', tasks);
    if (!tasks || tasks.length === 0) return;

    const TERMINAL = new Set(['SUCCESS', 'FAILURE']);
    let stopped = false;
    let intervalId: ReturnType<typeof setInterval>;

    const poll = async () => {
      if (stopped) return;
      try {
        console.log('[ingest poll] fetching status for', tasks.length, 'tasks');
        const response = await fetch(`${backendApiUrl}/ingest/status/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_ids: tasks.map(t => t.taskId) }),
        });
        if (!response.ok) {
          console.warn('[ingest poll] bad response', response.status, await response.text());
          return;
        }
        const data = await response.json();
        console.log('[ingest poll] statuses:', data);
        const statuses: TaskPollStatus[] = data.statuses.map((s: any, i: number) => ({
          paperId: tasks[i].paperId,
          taskId: tasks[i].taskId,
          state: s.state,
          result: s.result,
        }));
        setTaskStatuses(prev => {
          const updated = [...prev];
          for (const s of statuses) {
            const idx = updated.findIndex(t => t.taskId === s.taskId);
            if (idx >= 0) updated[idx] = s; else updated.push(s);
          }
          return updated;
        });

        if (statuses.every(s => TERMINAL.has(s.state))) {
          stopped = true;
          clearInterval(intervalId);
          const failed = statuses.filter(s => s.state === 'FAILURE' || s.result?.success === false).length;
          const skipped = statuses.filter(s => s.result?.method === 'skipped').length;
          const ingested = statuses.length - failed - skipped;
          const parts: string[] = [];
          if (ingested > 0) parts.push(`${ingested} ingested`);
          if (skipped > 0) parts.push(`${skipped} already existed`);
          if (failed > 0) parts.push(`${failed} failed`);
          setIngestStatus(prev => ({
            ...prev,
            status: failed === statuses.length ? 'error' : 'success',
            message: parts.join(', '),
          }));
          if (failed > 0) {
            toast.error('Some papers failed to ingest', { description: parts.join(', ') });
          } else {
            toast.success('Ingestion complete', { description: parts.join(', ') });
          }
        }
      } catch (_) {
        // silently ignore transient poll errors
      }
    };

    poll(); // immediate first poll
    intervalId = setInterval(poll, 2000);
    return () => { stopped = true; clearInterval(intervalId); };
  }, [ingestStatus.taskIds]);

  if (!props.papers || paperCount === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-muted-foreground">No papers found.</p>
      </div>
    );
  }

  const handleSelectChange = (paperId: string, selected: boolean) => {
    setTempSelected(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(paperId);
      } else {
        newSet.delete(paperId);
      }
      return newSet;
    });
  };

  const allSelected = paperCount > 0 && tempSelected.size === paperCount;

  const handleSelectAll = () => {
    if (allSelected) {
      setTempSelected(new Set());
    } else {
      setTempSelected(new Set(props.papers.map(p => p.paperId).filter(Boolean) as string[]));
    }
  };

  const handleAddToPaperList = async () => {
    if (tempSelected.size === 0) return;

    setIngestStatus({ status: 'ingesting', message: 'Adding papers to your list...' });

    try {
      // Filter papers to only include selected ones
      const papersToIngest = props.papers.filter(
        (p) => p.paperId && tempSelected.has(p.paperId)
      );

      // Make POST request to backend using backend API URL
      const response = await fetch(`${backendApiUrl}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          papers: papersToIngest,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to add papers (${response.status}): ${errorText || response.statusText}`);
      }

      const result = await response.json();

      // Add papers to persistent list (shown in side panel)
      papersToIngest.forEach(paper => {
        const paperData: PaperData = {
          paperId: paper.paperId,
          title: paper.title,
          authors: paper.authors,
          venue: paper.venue,
          publicationVenue: paper.publicationVenue,
          publicationDate: paper.publicationDate,
          year: paper.year,
          abstract: paper.abstract,
          citationCount: paper.citationCount,
          url: paper.url,
          openAccessPdf: paper.openAccessPdf,
        };
        selectPaper(paperData);
      });

      console.log('[ingest] /ingest response:', result);
      setIngestStatus({
        status: 'processing',
        message: `Processing ${result.tasks?.length ?? tempSelected.size} paper(s)…`,
        taskIds: result.tasks,
      });

      toast.success('Papers queued for ingestion', {
        description: `${result.tasks?.length ?? tempSelected.size} paper(s) are being processed in the background.`,
      });

      // Clear temporary selections
      setTempSelected(new Set());
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add papers';
      setIngestStatus({
        status: 'error',
        message: errorMessage,
      });

      // Show error toast
      toast.error('Failed to Add Papers', {
        description: errorMessage,
      });
    }
  };

  const selectedCount = tempSelected.size;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Found {paperCount} Paper{paperCount !== 1 ? 's' : ''}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              {selectedCount > 0
                ? `${selectedCount} paper${selectedCount !== 1 ? 's' : ''} selected`
                : 'Check papers below to add them to your list'}
              <span className="text-border">·</span>
              <button
                onClick={handleSelectAll}
                className="text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </p>
          </div>
          <button
            onClick={handleAddToPaperList}
            disabled={selectedCount === 0 || ingestStatus.status === 'ingesting'}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-all duration-200 text-sm ${
              selectedCount === 0 || ingestStatus.status === 'ingesting'
                ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
            }`}
          >
            {ingestStatus.status === 'ingesting' ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Adding…
              </span>
            ) : selectedCount > 0 ? `Add ${selectedCount} to list` : 'Add to list'}
          </button>
        </div>
      </div>

      {/* Progress / Status Panel */}
      {(taskStatuses.length > 0 || ingestStatus.status === 'ingesting' || ingestStatus.status === 'processing') && (
        <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/40 border-b border-border">
            <div className="flex items-center gap-2">
              {ingestStatus.status === 'processing' || ingestStatus.status === 'ingesting' ? (
                <svg className="w-3.5 h-3.5 text-indigo-400 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
              <span className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">Ingestion Status</span>
            </div>
            {taskStatuses.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {taskStatuses.filter(t => t.state === 'SUCCESS' || t.state === 'FAILURE').length} / {taskStatuses.length}
              </span>
            )}
          </div>

          {/* Progress bar */}
          {taskStatuses.length > 0 && (() => {
            const total = taskStatuses.length;
            const done = taskStatuses.filter(t => t.state === 'SUCCESS' || t.state === 'FAILURE').length;
            const pct = Math.round((done / total) * 100);
            return (
              <div className="h-0.5 bg-secondary">
                <div
                  className="h-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })()}

          {/* Rows */}
          <div className="px-4 py-2 space-y-1.5">
            {taskStatuses.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">Preparing tasks…</p>
            )}
            {taskStatuses.map(ts => {
              const isSuccess = ts.state === 'SUCCESS' && ts.result?.method !== 'skipped' && ts.result?.success !== false;
              const isSkipped = ts.state === 'SUCCESS' && ts.result?.method === 'skipped';
              const isFailed = ts.state === 'FAILURE' || ts.result?.success === false;
              const isActive = ts.state === 'STARTED';

              const dot = isSuccess
                ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                : isSkipped
                ? <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                : isFailed
                ? <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                : isActive
                ? <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                : <span className="w-1.5 h-1.5 rounded-full border border-border shrink-0" />;

              const label = isSuccess ? 'ingested'
                : isSkipped ? 'already in database'
                : isFailed ? 'failed'
                : isActive ? 'processing…'
                : 'queued…';

              const labelColor = isSuccess ? 'text-emerald-400 font-medium'
                : isSkipped ? 'text-muted-foreground'
                : isFailed ? 'text-red-400 font-medium'
                : 'text-muted-foreground';

              const paper = props.papers.find(p => p.paperId === ts.paperId);
              const errorMsg = isFailed ? (ts.result?.error ?? 'Unknown error') : null;
              return (
                <div key={ts.taskId} className="flex items-start gap-2.5 text-xs py-0.5">
                  <span className="mt-0.5 shrink-0">{dot}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`${labelColor} shrink-0`}>{label}</span>
                      <span className="text-muted-foreground truncate">{paper?.title ?? ts.paperId}</span>
                    </div>
                    {errorMsg && (
                      <p className="text-red-400 mt-0.5 leading-tight">{errorMsg}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          {ingestStatus.message && ingestStatus.status !== 'processing' && (
            <div className="px-4 py-2 bg-secondary/30 border-t border-border">
              <p className="text-xs text-muted-foreground">{ingestStatus.message}</p>
            </div>
          )}
        </div>
      )}

      {/* Papers List */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
        {props.papers.map((paper, index) => (
          <PaperComponent
            key={paper.paperId || paper.url || index}
            {...paper}
            isSelected={paper.paperId ? tempSelected.has(paper.paperId) : false}
            onSelectChange={handleSelectChange}
          />
        ))}
      </div>
    </div>
  );
};

export const PaperComponent = (props: PaperComponentProps) => {
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);

  // Helper to format authors
  const formatAuthors = () => {
    if (!props.authors || props.authors.length === 0) {
      return "Unknown authors";
    }
    
    // Handle array of author objects or strings
    const authorNames = props.authors.map((author: Author | string) => {
      if (typeof author === "string") return author;
      return author.name || "Unknown";
    });
    
    if (authorNames.length > 4) {
      return authorNames.slice(0, 4).join(", ") + ` ... ${authorNames[authorNames.length - 1]}`;
    }
    return authorNames.join(", ");
  };

  // Get venue name (prefer publicationVenue.name, fallback to venue)
  const venueName = props.publicationVenue?.name || props.venue || "Unknown venue";

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.onSelectChange && props.paperId) {
      props.onSelectChange(props.paperId, e.target.checked);
    }
  };

  return (
    <div className={`rounded-lg border transition-all duration-200 bg-card ${
      props.isSelected
        ? 'border-indigo-500/70 shadow-md ring-1 ring-indigo-500/30'
        : 'border-border hover:border-border/80 hover:shadow-sm'
    }`}>
      <div className="p-5">
        <div className="flex gap-4">
          {/* Checkbox */}
          <div className="flex-shrink-0 pt-1">
            <input
              type="checkbox"
              checked={props.isSelected || false}
              onChange={handleCheckboxChange}
              className="w-5 h-5 rounded border-border bg-secondary text-indigo-500 focus:ring-indigo-500 focus:ring-2 cursor-pointer"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title with external link */}
            <div className="flex items-start gap-2 mb-3">
              <h3 className="text-lg font-semibold text-foreground flex-1 leading-tight">
                {props.title || "Untitled Paper"}
              </h3>
              {props.url && (
                <a
                  href={props.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Open paper"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            {/* Authors */}
            <div className="text-sm text-foreground/80 mb-2">
              {formatAuthors()}
            </div>

            {/* Venue and Year */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <span>{venueName}</span>
              {props.year && (
                <>
                  <span className="text-border">•</span>
                  <span>{props.year}</span>
                </>
              )}
            </div>

            {/* Relevant badge (if selected) */}
            {props.isSelected && (
              <div className="mb-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 text-white text-sm font-medium">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Selected
                </span>
              </div>
            )}

            {/* Abstract - Click to expand/collapse */}
            <div
              className="mb-4 cursor-pointer group"
              onClick={() => setIsAbstractExpanded(!isAbstractExpanded)}
            >
              <div className={`text-sm text-foreground/80 leading-relaxed ${
                isAbstractExpanded ? '' : 'line-clamp-3'
              }`}>
                {props.abstract || "No abstract available."}
              </div>
              {props.abstract && props.abstract.length > 200 && (
                <button className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 font-medium">
                  {isAbstractExpanded ? '− Show less' : '+ Show more'}
                </button>
              )}
            </div>

            {/* Footer: Citation count and actions */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              {/* Citation count */}
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                <span className="text-muted-foreground">
                  Cited by <span className="font-semibold text-foreground">{props.citationCount?.toLocaleString() || 0}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-emerald-400 transition-colors"
                  aria-label="Like"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                  </svg>
                </button>
                <button
                  className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-red-400 transition-colors"
                  aria-label="Dislike"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14H5.236a2 2 0 01-1.789-2.894l3.5-7A2 2 0 018.736 3h4.018a2 2 0 01.485.06l3.76.94m-7 10v5a2 2 0 002 2h.096c.5 0 .905-.405.905-.904 0-.715.211-1.413.608-2.008L17 13V4m-7 10h2m5-10h2a2 2 0 012 2v6a2 2 0 01-2 2h-2.5" />
                  </svg>
                </button>
                <button
                  className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-indigo-400 transition-colors"
                  aria-label="Bookmark"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
