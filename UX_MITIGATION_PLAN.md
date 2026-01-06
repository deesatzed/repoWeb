# UX Mitigation & Workflow Enforcement Plan
**Created**: 2026-01-05
**Status**: DRAFT - Awaiting User Approval
**Target**: Enforce strict 7-step workflow + Fix A11Y violations

---

## PART 1: Workflow Architecture Redesign

### Current Problems
1. **Out-of-order operations**: Users can analyze before curating, group before analyzing, or skip analysis entirely
2. **Analysis-blind grouping**: Auto-curate uses only metadata (repo name, description, language) - ignores AI analysis results
3. **No workflow state**: System doesn't track "where user is" in the portfolio build process
4. **Confusing UI**: Multiple CTAs for same action across different tabs

### Target Workflow (User-Specified)

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Authentication                                     │
│  ├─ User logs in                                            │
│  └─ User enters GitHub token                                │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Repository Sync                                    │
│  ├─ User hits "Sync Now" button                             │
│  ├─ System fetches all repos from GitHub                    │
│  └─ Gate: Must have >0 repos to proceed                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: Manual Curation (Visibility Only)                  │
│  ├─ User marks repos as excluded/included                   │
│  ├─ NO grouping available yet                               │
│  ├─ Goal: Hide junk, keep quality work                      │
│  └─ Gate: Must have ≥1 included repo to proceed             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: Deep AI Analysis (MANDATORY, ALL INCLUDED)         │
│  ├─ System auto-triggers bulk analysis on all included      │
│  ├─ Analyzes: complexity, quality, architecture, skills     │
│  ├─ Generates: citations with code snippets                 │
│  ├─ Stores: All results in AIAnalysis table                 │
│  └─ Gate: Analysis must complete for ALL included repos     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 5: AI-Suggested Groupings                             │
│  ├─ System runs ENHANCED auto-curate                        │
│  ├─ Input: AI analysis results (not just metadata)          │
│  ├─ Suggests: Intelligent project groupings                 │
│  ├─ Logic: Groups repos with similar:                       │
│  │   • Architecture patterns                                │
│  │   • Tech stack                                           │
│  │   • Skills demonstrated                                  │
│  │   • Problem domain                                       │
│  └─ Presents: Preview of suggested groups                   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 6: User Refinement                                    │
│  ├─ User reviews AI suggestions                             │
│  ├─ Accepts/rejects groups                                  │
│  ├─ Moves repos between groups                              │
│  ├─ Creates custom groups                                   │
│  ├─ Edits group names/descriptions                          │
│  └─ Gate: User explicitly marks "Ready for Employers"       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 7: Public Portfolio (Employer View)                   │
│  ├─ URL: /portfolio/[username]                              │
│  ├─ Content:                                                │
│  │   • Curated project groups                               │
│  │   • Individual standout repos                            │
│  │   • AI-generated insights                                │
│  │   • Skills demonstrated                                  │
│  │   • Code quality metrics                                 │
│  │   • Architecture highlights                              │
│  └─ No auth required (public view)                          │
└─────────────────────────────────────────────────────────────┘
```

---

## PART 2: Implementation Tasks

### Task Group A: Workflow State Machine

**A1. Create Portfolio State Model**

Add to `prisma/schema.prisma`:

```prisma
enum PortfolioWorkflowState {
  INITIAL              // Just created, no GitHub connection
  CONNECTED            // GitHub connected, no repos
  SYNCED               // Repos synced, not curated
  CURATED              // Repos marked include/exclude
  ANALYZING            // Analysis in progress
  ANALYZED             // All included repos analyzed
  GROUPING_SUGGESTED   // AI suggestions generated
  FINALIZED            // User approved, ready for employers
}

model PortfolioSettings {
  // ... existing fields ...

  workflowState        PortfolioWorkflowState @default(INITIAL)
  workflowLockedAt     DateTime?  // When user marked as finalized
  stateTransitionLog   Json?      // Audit trail of state changes

  // ... rest of model ...
}
```

**A2. State Transition Rules (Backend)**

Create `nextjs_space/lib/workflow-state.ts`:

```typescript
import prisma from './db';
import { PortfolioWorkflowState } from '@prisma/client';

export class WorkflowStateError extends Error {
  constructor(
    message: string,
    public currentState: PortfolioWorkflowState,
    public attemptedAction: string
  ) {
    super(message);
  }
}

export async function validateTransition(
  userId: string,
  requiredState: PortfolioWorkflowState,
  action: string
): Promise<void> {
  const settings = await prisma.portfolioSettings.findUnique({
    where: { userId },
    select: { workflowState: true },
  });

  if (!settings) {
    throw new WorkflowStateError(
      'Portfolio settings not found',
      'INITIAL' as PortfolioWorkflowState,
      action
    );
  }

  const stateOrder = [
    'INITIAL',
    'CONNECTED',
    'SYNCED',
    'CURATED',
    'ANALYZING',
    'ANALYZED',
    'GROUPING_SUGGESTED',
    'FINALIZED',
  ];

  const currentIndex = stateOrder.indexOf(settings.workflowState);
  const requiredIndex = stateOrder.indexOf(requiredState);

  if (currentIndex < requiredIndex) {
    throw new WorkflowStateError(
      `Cannot ${action} - must complete previous steps first. Current: ${settings.workflowState}, Required: ${requiredState}`,
      settings.workflowState,
      action
    );
  }
}

export async function transitionState(
  userId: string,
  newState: PortfolioWorkflowState
): Promise<void> {
  const settings = await prisma.portfolioSettings.findUnique({
    where: { userId },
    select: { workflowState: true, stateTransitionLog: true },
  });

  const log = (settings?.stateTransitionLog as any[]) || [];
  log.push({
    from: settings?.workflowState || 'INITIAL',
    to: newState,
    at: new Date().toISOString(),
  });

  await prisma.portfolioSettings.upsert({
    where: { userId },
    create: {
      userId,
      workflowState: newState,
      stateTransitionLog: log,
    },
    update: {
      workflowState: newState,
      stateTransitionLog: log,
    },
  });
}

export async function canPerformAction(
  userId: string,
  action: 'sync' | 'curate' | 'group' | 'analyze' | 'finalize'
): Promise<{ allowed: boolean; reason?: string; currentState: string }> {
  const settings = await prisma.portfolioSettings.findUnique({
    where: { userId },
    select: { workflowState: true },
  });

  const state = settings?.workflowState || 'INITIAL';

  const rules: Record<typeof action, PortfolioWorkflowState[]> = {
    sync: ['CONNECTED', 'SYNCED', 'CURATED', 'ANALYZING', 'ANALYZED', 'GROUPING_SUGGESTED', 'FINALIZED'],
    curate: ['SYNCED', 'CURATED', 'ANALYZING', 'ANALYZED', 'GROUPING_SUGGESTED', 'FINALIZED'],
    analyze: ['CURATED'], // ONLY after curation
    group: ['ANALYZED', 'GROUPING_SUGGESTED', 'FINALIZED'], // ONLY after analysis
    finalize: ['GROUPING_SUGGESTED', 'FINALIZED'],
  };

  const allowed = rules[action].includes(state as PortfolioWorkflowState);

  return {
    allowed,
    reason: allowed ? undefined : `Must complete previous steps. Current state: ${state}`,
    currentState: state,
  };
}
```

**A3. Enforce State Checks in API Routes**

Modify each route to check state before proceeding:

- `app/api/github/sync/route.ts`:
  ```typescript
  const check = await canPerformAction(session.user.id, 'sync');
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }
  ```

- `app/api/curate/auto/route.ts`:
  ```typescript
  // Line 22: Add state check
  await validateTransition(session.user.id, 'ANALYZED', 'generate grouping suggestions');
  ```

- `app/api/analyze/repository/route.ts`:
  ```typescript
  const check = await canPerformAction(session.user.id, 'analyze');
  if (!check.allowed) {
    return NextResponse.json({ error: check.reason }, { status: 403 });
  }
  ```

---

### Task Group B: Mandatory Analysis Workflow

**B1. Auto-Trigger Analysis After Curation**

Create new endpoint `app/api/workflow/complete-curation/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';
import { transitionState } from '@/lib/workflow-state';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Count included repos
  const connection = await prisma.gitHubConnection.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!connection) {
    return NextResponse.json({ error: 'No GitHub connection' }, { status: 400 });
  }

  const includedCount = await prisma.repository.count({
    where: {
      githubConnectionId: connection.id,
      isExcluded: false,
    },
  });

  if (includedCount === 0) {
    return NextResponse.json(
      { error: 'Must include at least one repository before proceeding' },
      { status: 400 }
    );
  }

  // Transition to CURATED state
  await transitionState(session.user.id, 'CURATED');

  // Return signal to start analysis
  return NextResponse.json({
    success: true,
    nextStep: 'analyze',
    includedCount,
  });
}
```

**B2. Modify Curation UI to Enforce Sequence**

Update `app/dashboard/_components/portfolio-curation.tsx`:

Add "Complete Curation" button that:
1. Validates at least 1 repo is included
2. Calls `/api/workflow/complete-curation`
3. Automatically navigates to analysis tab
4. Triggers bulk analysis

```typescript
const handleCompleteCuration = async () => {
  const includedCount = repositories.filter(r => !r.isExcluded).length;

  if (includedCount === 0) {
    toast.error('Must include at least one repository before proceeding to analysis');
    return;
  }

  try {
    const res = await fetch('/api/workflow/complete-curation', {
      method: 'POST',
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Failed to complete curation');
    }

    toast.success(`Ready to analyze ${data.includedCount} repositories`);

    // Navigate to analysis tab and trigger
    onNavigateToAnalysis?.(); // Callback to parent dashboard

  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Failed to proceed');
  }
};
```

---

### Task Group C: Analysis-Driven Auto-Curate

**C1. Enhance Auto-Curate to Use Analysis Results**

Modify `app/api/curate/auto/route.ts` (line 85 onwards):

```typescript
// NEW: Fetch repositories WITH their analysis results
const repositories = await prisma.repository.findMany({
  where: {
    githubConnection: {
      userId: session.user.id,
    },
    isExcluded: false, // Only analyze included repos
  },
  select: {
    id: true,
    name: true,
    description: true,
    language: true,
    topics: true,
    stargazersCount: true,
    isFork: true,
    updatedAt: true,
    aiAnalysis: { // CRITICAL: Include analysis results
      select: {
        complexityScore: true,
        codeQualityScore: true,
        projectType: true,
        techStack: true,
        architecturePatterns: true,
        skillsDemonstrated: true,
        summary: true,
      },
    },
  },
});

// NEW: Build enriched context for LLM
const repoList = repositories.map(r => ({
  id: r.id,
  name: r.name,
  description: r.description || '',
  language: r.language || 'Unknown',
  topics: r.topics,
  stars: r.stargazersCount,
  isFork: r.isFork,
  lastUpdate: r.updatedAt.toISOString().split('T')[0],

  // NEW: AI analysis data
  analysis: r.aiAnalysis ? {
    complexityScore: r.aiAnalysis.complexityScore,
    codeQualityScore: r.aiAnalysis.codeQualityScore,
    projectType: r.aiAnalysis.projectType,
    techStack: r.aiAnalysis.techStack,
    architecturePatterns: r.aiAnalysis.architecturePatterns,
    skillsDemonstrated: r.aiAnalysis.skillsDemonstrated,
    summary: r.aiAnalysis.summary,
  } : null,
}));

// NEW: Enhanced LLM prompt
const prompt = `You are an expert Technical Recruiter and Engineering Manager organizing a candidate's portfolio.

You have DEEP AI ANALYSIS RESULTS for ${repoList.length} GitHub repositories. Each repo includes:
- Code quality and complexity scores (0-100)
- Project type classification
- Architecture patterns identified
- Technical skills demonstrated
- AI-generated summary

Your goal: Create INTELLIGENT project groupings based on actual code analysis, not just metadata.

CRITICAL RULES:
1. Group repos with RELATED architecture patterns (e.g., microservices, event-driven, monolith)
2. Group repos demonstrating SIMILAR skills (e.g., React + Node.js full-stack)
3. Group repos solving RELATED problems (e.g., healthcare data processing)
4. DO NOT group high-quality standalone work just to reduce clutter
5. BE SELECTIVE: Only group if there's clear thematic/technical cohesion

INPUT DATA (with AI analysis):
${JSON.stringify(repoList, null, 2)}

RESPOND WITH JSON ONLY:
{
  "projects": [
    {
      "name": "Specific Project Name",
      "description": "Brief professional summary emphasizing skills and architecture",
      "repositoryIds": ["id_1", "id_2"],
      "groupingRationale": "Why these repos belong together (reference analysis data)"
    }
  ],
  "standaloneHighlights": ["id_of_impressive_solo_work"],
  "reasoning": "Overall strategy for organizing this portfolio"
}
`;
```

**C2. Validate Analysis Exists Before Grouping**

Add check in auto-curate route:

```typescript
// After fetching repositories, before calling LLM
const unanalyzedRepos = repositories.filter(r => !r.aiAnalysis);

if (unanalyzedRepos.length > 0) {
  return NextResponse.json(
    {
      error: 'All included repositories must be analyzed before grouping',
      unanalyzedCount: unanalyzedRepos.length,
      unanalyzedRepos: unanalyzedRepos.map(r => ({ id: r.id, name: r.name })),
    },
    { status: 400 }
  );
}
```

---

### Task Group D: UI Workflow Enforcement

**D1. State-Aware Navigation**

Create `app/dashboard/_components/workflow-stepper.tsx`:

```typescript
'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  state: 'completed' | 'current' | 'locked';
}

interface WorkflowStepperProps {
  currentState: string;
  onStepClick?: (stepId: string) => void;
}

export function WorkflowStepper({ currentState, onStepClick }: WorkflowStepperProps) {
  const stateToStep: Record<string, number> = {
    INITIAL: 0,
    CONNECTED: 1,
    SYNCED: 2,
    CURATED: 3,
    ANALYZING: 4,
    ANALYZED: 4,
    GROUPING_SUGGESTED: 5,
    FINALIZED: 6,
  };

  const currentStepIndex = stateToStep[currentState] || 0;

  const steps: WorkflowStep[] = [
    {
      id: 'connect',
      label: 'Connect GitHub',
      description: 'Link your account',
      state: currentStepIndex >= 1 ? 'completed' : currentStepIndex === 0 ? 'current' : 'locked',
    },
    {
      id: 'sync',
      label: 'Sync Repos',
      description: 'Fetch repositories',
      state: currentStepIndex >= 2 ? 'completed' : currentStepIndex === 1 ? 'current' : 'locked',
    },
    {
      id: 'curate',
      label: 'Curate',
      description: 'Include/exclude work',
      state: currentStepIndex >= 3 ? 'completed' : currentStepIndex === 2 ? 'current' : 'locked',
    },
    {
      id: 'analyze',
      label: 'Deep Analysis',
      description: 'AI code review',
      state: currentStepIndex >= 5 ? 'completed' : currentStepIndex === 4 ? 'current' : 'locked',
    },
    {
      id: 'group',
      label: 'Organize',
      description: 'Group projects',
      state: currentStepIndex >= 6 ? 'completed' : currentStepIndex === 5 ? 'current' : 'locked',
    },
    {
      id: 'finalize',
      label: 'Publish',
      description: 'Go live',
      state: currentStepIndex >= 7 ? 'completed' : currentStepIndex === 6 ? 'current' : 'locked',
    },
  ];

  return (
    <div className="flex items-center justify-between gap-2 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center gap-2 flex-1">
          <button
            onClick={() => step.state !== 'locked' && onStepClick?.(step.id)}
            disabled={step.state === 'locked'}
            className={`flex items-center gap-3 p-2 rounded-md transition-all ${
              step.state === 'completed'
                ? 'text-green-300 bg-green-500/10 cursor-pointer hover:bg-green-500/20'
                : step.state === 'current'
                ? 'text-purple-300 bg-purple-500/10 ring-2 ring-purple-500/50'
                : 'text-slate-600 cursor-not-allowed'
            }`}
          >
            {step.state === 'completed' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : step.state === 'locked' ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
            <div className="text-left">
              <p className="text-xs font-bold">{step.label}</p>
              <p className="text-[10px] opacity-70">{step.description}</p>
            </div>
          </button>
          {index < steps.length - 1 && (
            <div className={`h-px flex-1 ${currentStepIndex > index ? 'bg-green-500' : 'bg-slate-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}
```

**D2. Gate UI Elements Based on State**

In `dashboard-client.tsx`, conditionally render tabs:

```typescript
const { workflowState } = useWorkflowState(); // New hook to fetch state

// In tabs section:
<TabsList>
  <TabsTrigger value="repositories" disabled={workflowState === 'INITIAL' || workflowState === 'CONNECTED'}>
    Repositories
  </TabsTrigger>
  <TabsTrigger value="curate" disabled={workflowState === 'INITIAL' || workflowState === 'CONNECTED'}>
    Curate
  </TabsTrigger>
  <TabsTrigger value="groups" disabled={workflowState !== 'ANALYZED' && workflowState !== 'GROUPING_SUGGESTED'}>
    Organize Groups
  </TabsTrigger>
</TabsList>
```

---

## PART 3: A11Y & UX Fixes

### Fix Group 1: ARIA Announcements (P0)

**File**: `app/auth/signin/page.tsx`

**Line 98**: Add `role="status"` to OAuth warning:

```tsx
<div role="status" aria-live="polite" className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
  <div className="flex items-start gap-3">
    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
    <div>
      <p className="text-sm text-amber-200 font-medium">GitHub OAuth Not Configured</p>
      <p className="text-xs text-amber-300/70 mt-1">
        To enable instant GitHub sign-in, configure GitHub OAuth credentials in your environment settings.
      </p>
    </div>
  </div>
</div>
```

**File**: `app/dashboard/_components/dashboard-client.tsx`

**Line 341**: Add ARIA to refresh overlay:

```tsx
<div
  role="status"
  aria-live="assertive"
  aria-busy="true"
  className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-none"
>
  <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in-95 duration-200">
    <div className="w-12 h-12 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" aria-hidden="true" />
    <div className="text-center">
      <p className="text-white font-bold">Syncing Data...</p>
      <p className="text-slate-400 text-xs mt-1">Fetching latest from GitHub & AI</p>
    </div>
  </div>
</div>
```

**File**: `app/dashboard/_components/repository-list.tsx`

**Line 387**: Add progressbar role:

```tsx
<div
  role="progressbar"
  aria-valuenow={bulkProgress.current}
  aria-valuemin={0}
  aria-valuemax={bulkProgress.total}
  aria-label={`Analyzing repositories: ${bulkProgress.current} of ${bulkProgress.total} complete`}
  className="h-2 bg-slate-700 rounded-full overflow-hidden"
>
  <div
    className="h-full bg-purple-500 transition-all duration-500"
    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
  />
</div>
```

---

### Fix Group 2: Form Error Association (P0)

**File**: `app/auth/signin/page.tsx`

Add error state management:

```typescript
const [errors, setErrors] = useState<{
  email?: string;
  password?: string;
  general?: string;
}>({});

// In handleSubmit:
if (result?.error) {
  setErrors({ general: 'Invalid email or password. Please try again.' });
  toast.error('Invalid credentials');
} else {
  setErrors({});
  toast.success('Signed in successfully!');
  router.push('/dashboard');
}
```

Update email input:

```tsx
<div className="space-y-2">
  <Label htmlFor="email" className="text-slate-200">
    Email
  </Label>
  <div className="relative">
    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" aria-hidden="true" />
    <Input
      id="email"
      type="email"
      value={email}
      onChange={(e) => {
        setEmail(e?.target?.value ?? '');
        if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
      }}
      className="pl-10 bg-slate-900/50 border-slate-600 text-white"
      aria-invalid={!!errors.email}
      aria-describedby={errors.email ? "email-error" : undefined}
      required
    />
  </div>
  {errors.email && (
    <p id="email-error" role="alert" className="text-red-400 text-sm mt-1">
      {errors.email}
    </p>
  )}
</div>

{errors.general && (
  <div role="alert" className="p-3 rounded-md bg-red-500/10 border border-red-500/30">
    <p className="text-red-400 text-sm">{errors.general}</p>
  </div>
)}
```

---

### Fix Group 3: Performance Optimization (P1)

**File**: Create `app/api/dashboard/init/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import prisma from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Single query with all related data
    const [connection, settings, repos, stats] = await Promise.all([
      // GitHub connection
      prisma.gitHubConnection.findUnique({
        where: { userId: session.user.id },
        select: {
          githubUsername: true,
          lastSyncedAt: true,
        },
      }),

      // Portfolio settings
      prisma.portfolioSettings.findUnique({
        where: { userId: session.user.id },
        select: {
          displayName: true,
          bio: true,
          location: true,
          workflowState: true,
        },
      }),

      // Highlight repos (top 3 with analysis)
      prisma.repository.findMany({
        where: {
          githubConnection: { userId: session.user.id },
          isExcluded: false,
          aiAnalysis: { isNot: null },
        },
        take: 3,
        orderBy: [
          { isFeatured: 'desc' },
          { stargazersCount: 'desc' },
        ],
        include: {
          aiAnalysis: {
            select: {
              employerHighlights: true,
              skillsDemonstrated: true,
            },
          },
        },
      }),

      // Aggregate stats
      prisma.repository.aggregate({
        where: {
          githubConnection: { userId: session.user.id },
        },
        _count: {
          id: true,
        },
        _sum: {
          stargazersCount: true,
        },
      }),
    ]);

    const [excludedCount, analyzedCount, projectCount] = await Promise.all([
      prisma.repository.count({
        where: {
          githubConnection: { userId: session.user.id },
          isExcluded: true,
        },
      }),
      prisma.repository.count({
        where: {
          githubConnection: { userId: session.user.id },
          aiAnalysis: { isNot: null },
        },
      }),
      prisma.project.count({
        where: { userId: session.user.id },
      }),
    ]);

    return NextResponse.json({
      connection: connection
        ? {
            connected: true,
            githubUsername: connection.githubUsername,
            lastSyncedAt: connection.lastSyncedAt?.toISOString(),
          }
        : { connected: false },
      settings,
      highlightRepos: repos,
      stats: {
        repoCount: stats._count.id || 0,
        excludedCount,
        analyzedCount,
        projectCount,
        totalStars: stats._sum.stargazersCount || 0,
        hasRepos: (stats._count.id || 0) > 0,
        isAnalyzed: analyzedCount >= (stats._count.id || 0) - excludedCount,
      },
    });
  } catch (error: any) {
    console.error('Dashboard init error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data', details: error?.message },
      { status: 500 }
    );
  }
}
```

**File**: `app/dashboard/_components/dashboard-client.tsx`

Replace lines 78-148 with:

```typescript
useEffect(() => {
  fetchDashboardInit();

  const handleReset = () => {
    fetchDashboardInit();
    setSyncSummary(null);
    setSyncError(null);
  };

  window.addEventListener('portfolio-reset', handleReset);
  return () => window.removeEventListener('portfolio-reset', handleReset);
}, []);

const fetchDashboardInit = async () => {
  try {
    setLoading(true);
    const response = await fetchWithTimeout(`/api/dashboard/init?t=${Date.now()}`);
    const data = await response.json();

    setConnection(data.connection);
    setSettings(data.settings);
    setHighlightRepos(data.highlightRepos || []);
    setStats(data.stats);
  } catch (error) {
    console.error('Failed to fetch dashboard init:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## PART 4: Testing Requirements

### Test Suite 1: Workflow State Enforcement

```typescript
// tests/workflow-state.test.ts

describe('Workflow State Machine', () => {
  test('should prevent grouping before analysis', async () => {
    // Set state to CURATED (analysis not done)
    await transitionState(userId, 'CURATED');

    // Attempt to call auto-curate
    const res = await fetch('/api/curate/auto', {
      method: 'POST',
      body: JSON.stringify({ intent: 'manual', mode: 'preview' }),
    });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('must be analyzed');
  });

  test('should allow grouping after analysis', async () => {
    // Set state to ANALYZED
    await transitionState(userId, 'ANALYZED');

    const res = await fetch('/api/curate/auto', {
      method: 'POST',
      body: JSON.stringify({ intent: 'manual', mode: 'preview' }),
    });

    expect(res.status).toBe(200);
  });

  test('should enforce analysis on all included repos', async () => {
    // Create 5 repos, analyze only 3
    await createTestRepos(5);
    await analyzeRepos([0, 1, 2]); // Only 3 out of 5

    const res = await fetch('/api/curate/auto', {
      method: 'POST',
      body: JSON.stringify({ intent: 'manual', mode: 'preview' }),
    });

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.unanalyzedCount).toBe(2);
  });
});
```

### Test Suite 2: Analysis-Driven Grouping

```typescript
// tests/auto-curate-analysis.test.ts

describe('Auto-Curate with Analysis', () => {
  test('should group repos with similar architecture patterns', async () => {
    // Create repos with analysis indicating microservices
    await createRepoWithAnalysis({
      name: 'user-service',
      analysis: {
        architecturePatterns: ['microservices', 'REST API', 'event-driven'],
        techStack: ['Node.js', 'PostgreSQL', 'RabbitMQ'],
      },
    });

    await createRepoWithAnalysis({
      name: 'payment-service',
      analysis: {
        architecturePatterns: ['microservices', 'REST API', 'event-driven'],
        techStack: ['Node.js', 'PostgreSQL', 'RabbitMQ'],
      },
    });

    const res = await fetch('/api/curate/auto', {
      method: 'POST',
      body: JSON.stringify({ intent: 'manual', mode: 'preview' }),
    });

    const data = await res.json();

    // Should group these two together
    expect(data.plan.projects).toHaveLength(1);
    expect(data.plan.projects[0].repositoryIds).toHaveLength(2);
    expect(data.plan.projects[0].name).toContain('Microservice');
  });

  test('should not group unrelated high-quality repos', async () => {
    // Create two high-quality but unrelated repos
    await createRepoWithAnalysis({
      name: 'machine-learning-model',
      analysis: {
        codeQualityScore: 95,
        architecturePatterns: ['deep learning', 'Python'],
        skillsDemonstrated: ['TensorFlow', 'model optimization'],
      },
    });

    await createRepoWithAnalysis({
      name: 'react-component-library',
      analysis: {
        codeQualityScore: 92,
        architecturePatterns: ['component-driven', 'TypeScript'],
        skillsDemonstrated: ['React', 'design systems'],
      },
    });

    const res = await fetch('/api/curate/auto', {
      method: 'POST',
      body: JSON.stringify({ intent: 'manual', mode: 'preview' }),
    });

    const data = await res.json();

    // Should NOT group - leave as standalones
    expect(data.plan.projects).toHaveLength(0);
    expect(data.plan.standaloneHighlights).toHaveLength(2);
  });
});
```

### Test Suite 3: A11Y Validation

```typescript
// tests/a11y.test.ts
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Accessibility', () => {
  test('signin page should have no a11y violations', async () => {
    const { container } = render(<SignInPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('dashboard should announce state changes', async () => {
    const { getByRole } = render(<DashboardClient />);

    // Trigger sync
    fireEvent.click(getByText('Sync Now'));

    // Should have live region announcing status
    const status = getByRole('status');
    expect(status).toBeInTheDocument();
    expect(status).toHaveAttribute('aria-live', 'assertive');
  });

  test('progress bar should have proper ARIA attributes', async () => {
    const { getByRole } = render(<RepositoryList />);

    // Start bulk analysis
    fireEvent.click(getByText('Analyze All'));

    const progressbar = getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax');
  });
});
```

---

## PART 5: Deployment Checklist

### Pre-Deployment
- [ ] Run migration: `npx prisma migrate dev --name add_workflow_state`
- [ ] Generate Prisma client: `npx prisma generate`
- [ ] Run test suite: `npm test` (all tests must pass)
- [ ] Run a11y tests: `npm run test:a11y`
- [ ] Manual smoke test of full workflow (1-7 steps)
- [ ] Verify public portfolio route renders correctly

### Deployment
- [ ] Commit all changes with descriptive message
- [ ] Push to main branch
- [ ] Deploy to Fly.io: `fly deploy`
- [ ] Run migration on production: `fly ssh console` → `npx prisma db push`
- [ ] Verify environment variables set in Fly secrets
- [ ] Test production URL: https://reponexus-portfolio.fly.dev/

### Post-Deployment Verification
- [ ] Sign up new test account
- [ ] Complete full workflow (steps 1-7)
- [ ] Verify state transitions log correctly
- [ ] Verify auto-curate uses analysis results
- [ ] Verify public portfolio URL works
- [ ] Check Fly logs for errors: `fly logs`

---

## PART 6: Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Breaking existing users** | Medium | High | Add migration to set existing users to appropriate state based on current data |
| **LLM grouping quality regression** | Low | Medium | A/B test old vs. new prompts; keep both temporarily |
| **State machine deadlocks** | Low | High | Add admin override endpoint to manually set state |
| **Performance degradation** | Low | Medium | Monitor dashboard init endpoint response time; add caching if needed |
| **Analysis timeout on large portfolios** | Medium | Medium | Add timeout handling + partial analysis support |

### Rollback Plan

If critical issues arise:

1. **Immediate**: Revert Fly deployment to previous version (`fly releases` → `fly deploy --image <previous>`)
2. **Database**: Workflow state is additive (doesn't break existing data)
3. **Feature flag**: Add `ENABLE_WORKFLOW_GATING` env var to disable gating temporarily

---

## PART 7: Success Metrics

### Quantitative Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **A11Y violations** | Unknown | 0 WCAG AA violations | axe-core automated scan |
| **Dashboard load time** | ~800ms (4 sequential fetches) | <300ms (single fetch) | Network waterfall in DevTools |
| **User drop-off at analysis step** | Unknown | <10% | Analytics tracking |
| **Grouping quality (subjective)** | N/A | >80% user acceptance rate | Post-grouping survey |

### Qualitative Metrics

- **User feedback**: Survey users after using new workflow
- **Employer feedback**: Does portfolio effectively communicate skills?
- **Completion rate**: % of users who reach "Finalized" state

---

## PART 8: Timeline Estimate

**Note**: Per user requirements, NO time estimates for completion. This is a task dependency chart only.

### Phase 1: Workflow State Machine (Dependencies: None)
- Task A1: Create state model (Prisma schema)
- Task A2: Implement state transition logic
- Task A3: Add state checks to existing routes

### Phase 2: Mandatory Analysis (Dependencies: Phase 1)
- Task B1: Create workflow completion endpoint
- Task B2: Modify curation UI to enforce sequence

### Phase 3: Analysis-Driven Grouping (Dependencies: Phase 2)
- Task C1: Enhance auto-curate with analysis data
- Task C2: Add analysis validation before grouping

### Phase 4: UI Enforcement (Dependencies: Phase 3)
- Task D1: Build workflow stepper component
- Task D2: Gate UI elements based on state

### Phase 5: A11Y Fixes (Dependencies: None, can parallelize)
- Fix Group 1: ARIA announcements
- Fix Group 2: Form error association
- Fix Group 3: Performance optimization

### Phase 6: Testing (Dependencies: All above)
- Test Suite 1: Workflow state enforcement
- Test Suite 2: Analysis-driven grouping
- Test Suite 3: A11Y validation

### Phase 7: Deployment (Dependencies: Phase 6)
- Migration execution
- Production deployment
- Verification

---

## Approval Required

**Before proceeding**, user must approve:

1. **Workflow sequence**: Is the 7-step flow correctly captured?
2. **Gating strategy**: Is state machine enforcement acceptable?
3. **Analysis-driven grouping**: Should auto-curate use full analysis data?
4. **UI changes**: Is the workflow stepper the right approach?
5. **A11Y priorities**: Are P0 fixes sufficient for initial release?

**Next Steps After Approval**:
1. User confirms workflow sequence
2. Begin Phase 1 implementation
3. Create feature branch: `feature/workflow-enforcement`
4. Implement in phases with incremental testing
5. Submit for review after Phase 3 (before UI changes)

---

**Document Version**: 1.0
**Last Updated**: 2026-01-05
**Status**: AWAITING USER APPROVAL
