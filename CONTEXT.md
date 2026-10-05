# Safalya — Developer Context

> **Read this before writing any code.**
> This file documents the architecture, conventions, and patterns used in this project.
> It is intended to be used as context by both human developers and AI coding assistants.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Layers](#4-architecture-layers)
5. [Service Layer — How to Fetch Data](#5-service-layer--how-to-fetch-data)
6. [API Routes (Next.js Proxy Layer)](#6-api-routes-nextjs-proxy-layer)
7. [Auth & Cookie Conventions](#7-auth--cookie-conventions)
8. [Pagination Pattern](#8-pagination-pattern)
9. [State Management](#9-state-management)
10. [Loader / Loading States](#10-loader--loading-states)
11. [UI Component Conventions](#11-ui-component-conventions)
12. [How to Add a New Feature (Checklist)](#12-how-to-add-a-new-feature-checklist)
13. [Common Mistakes to Avoid](#13-common-mistakes-to-avoid)

---

## 1. Project Overview

Safalya is a quiz/exam management platform with two separate codebases:

| Codebase | Path | Tech | Purpose |
|---|---|---|---|
| **Frontend** | `question_genarator/` | Next.js 16, React 19, TypeScript, Tailwind v4, shadcn | Teacher/admin/student UI |
| **Backend** | `question_genarated_api/` | FastAPI (Python), SQLAlchemy, SQLite | REST API |

**User Roles:**

| Role Value | Name | Capabilities |
|---|---|---|
| `0` | Super Admin | Full access, manages organizations |
| `1` | Admin | Manages their organization |
| `2` | Teacher | Creates questions/test series |
| `3` | Student | Takes tests, views history |

---

## 2. Tech Stack

### Frontend (`question_genarator/`)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4 + shadcn/ui (`@base-ui/react`)
- **Icons**: `lucide-react`
- **Toast**: `sonner`
- **Theme**: `next-themes` (dark/light)
- **Rich Text**: `react-quill-new`

### Backend (`question_genarated_api/`)
- **Framework**: FastAPI (Python)
- **ORM**: SQLAlchemy
- **DB**: SQLite (`questions.db`)
- **Auth**: JWT Bearer tokens
- **Migration**: Alembic

---

## 3. Project Structure

```
question_genarator/
├── app/
│   ├── api/                    # Next.js API proxy routes (client → backend)
│   │   ├── auth/               # login, logout, register
│   │   ├── backend/            # generic catch-all proxy
│   │   ├── organizations/      # org CRUD proxy
│   │   └── questions/          # question CRUD proxy
│   ├── lib/
│   │   ├── api-url.ts          # getApiUrl() — builds backend URL from env
│   │   ├── api-client.ts       # ApiClient class — for Server Components/services
│   │   └── backend-proxy.ts    # BackendProxy class — for API route handlers
│   ├── services/               # Typed wrappers around backend API
│   │   ├── questions.ts
│   │   ├── topics.ts
│   │   ├── organizations.ts
│   │   ├── test-series.ts
│   │   ├── users.ts
│   │   └── student.ts
│   ├── [feature]/
│   │   ├── page.tsx            # Server Component — fetches data, handles redirects
│   │   ├── loading.tsx         # Shown by Next.js while page.tsx is loading
│   │   └── [feature-name].tsx  # Client Component — interactive UI
│   └── loading.tsx             # Root loading — shown for ALL pages
├── components/
│   ├── loader.tsx              # Reusable Loader component (fullPage, inline, overlay)
│   ├── app-sidebar.tsx
│   └── ui/                     # shadcn components
└── CONTEXT.md                  # ← You are here
```

---

## 4. Architecture Layers

```
Browser (Client Component)
        │ fetch("/api/...")
        ▼
Next.js API Route (/app/api/...)    ← uses BackendProxy
        │ fetch(BACKEND_URL, { Authorization: Bearer ... })
        ▼
FastAPI Backend (question_genarated_api/)
        │
        ▼
SQLite Database
```

**Server Components** fetch data directly via services (no browser involved):
```
page.tsx (Server Component)
        │ await service()
        ▼
services/*.ts                       ← uses ApiClient
        │ fetch(BACKEND_URL, { Authorization: Bearer ... })
        ▼
FastAPI Backend
```

---

## 5. Service Layer — How to Fetch Data

### ✅ Always use the service layer — never call `getApiUrl()` directly in page files

Every backend resource has a typed service file in `app/services/`.

**To fetch data in a Server Component (`page.tsx`):**
```typescript
import { getAllTopics } from "@/app/services/topics";
import { getStudentTests } from "@/app/services/student";

// In an async server component:
const topics = await getAllTopics();
const tests = await getStudentTests({ page: "1", limit: "10" });
```

**All service functions use `createApiClient()` internally — you never need to handle tokens yourself.**

### Available services

| Service file | Functions |
|---|---|
| `services/questions.ts` | `getAllQuestions`, `getQuestionsByIds`, `getQuestion`, `createQuestion`, `updateQuestion`, `deleteQuestion`, `createQuestionOption` |
| `services/topics.ts` | `getAllTopics`, `getTopic`, `createTopic`, `updateTopic`, `deleteTopic` |
| `services/organizations.ts` | `getAllOrganizations`, `getOrganization`, `getOrganizationUsers` |
| `services/test-series.ts` | `getAllTestSeries`, `getTestSeries`, `updateTestSeries`, `getTestSeriesResults` |
| `services/users.ts` | `getAllUsers`, `getUser` |
| `services/student.ts` | `getStudentTests`, `getStudentAttempt`, `getAttemptHistory`, `getTestSeriesQuestions` |

### Adding a new service function
```typescript
// app/services/my-resource.ts
import { createApiClient } from "../lib/api-client";

export type MyResource = { id: number; name: string; };

export async function getMyResource(id: number): Promise<MyResource> {
    const client = await createApiClient();
    return client.get<MyResource>(`my-resource/${id}`);
}

export async function createMyResource(data: Partial<MyResource>): Promise<MyResource> {
    const client = await createApiClient();
    return client.post<MyResource>("my-resource/", data);
}
```

---

## 6. API Routes (Next.js Proxy Layer)

API routes at `app/api/` act as an **authenticated proxy** between client components and the backend. They read the `access_token` cookie and forward requests.

### ✅ Always use `createBackendProxy` — never write manual token+fetch in API routes

```typescript
// app/api/my-resource/route.ts
import { NextRequest } from "next/server";
import { createBackendProxy, unauthorizedResponse, errorResponse } from "../../lib/backend-proxy";

export async function GET(request: NextRequest) {
    try {
        const proxy = await createBackendProxy();
        if (!proxy) return unauthorizedResponse();
        return proxy.forward("my-resource/", { searchParams: request.nextUrl.searchParams });
    } catch {
        return errorResponse("Failed to fetch my resource.");
    }
}

export async function POST(request: NextRequest) {
    try {
        const proxy = await createBackendProxy();
        if (!proxy) return unauthorizedResponse();
        const body = await request.json();
        return proxy.forward("my-resource/", { method: "POST", body });
    } catch {
        return errorResponse("Failed to create my resource.");
    }
}
```

### `BackendProxy` methods

| Method | Usage |
|---|---|
| `proxy.forward(path, options)` | Forwards a request to the backend, returns `NextResponse` |
| `proxy.getToken()` | Get the raw token string |
| `proxy.getAuthHeaders(includeJson?)` | Get headers object for use with services |

### `forward()` options

```typescript
proxy.forward("path/", {
    method: "GET" | "POST" | "PATCH" | "DELETE",  // default: GET
    body: object,       // auto JSON.stringify'd
    searchParams: URLSearchParams,  // forwarded as query params
});
```

---

## 7. Auth & Cookie Conventions

After login, the backend sets these cookies (handled by `app/api/auth/login/route.ts`):

| Cookie | Value | Example |
|---|---|---|
| `access_token` | JWT string | `eyJ...` |
| `user_role` | Role number as string | `"0"`, `"1"`, `"2"`, `"3"` |
| `user_id` | User ID as string | `"42"` |
| `user_name` | Display name | `"Alice"` |
| `organization_id` | Org ID as string (or empty) | `"7"` |
| `organization_name` | Org name (or empty) | `"Acme School"` |

### Auth guard pattern in `page.tsx`
```typescript
// Standard auth guard — always do this in page.tsx
const cookieStore = await cookies();
if (!cookieStore.has("access_token")) redirect("/login");

// Role guard
const role = cookieStore.get("user_role")?.value;
if (role !== "0") redirect("/dashboard");         // super admin only
if (role === "3") redirect("/student/tests");     // block students
```

> ⚠️ **Never use token for API calls in page.tsx directly.**
> Use `services/*.ts` functions instead — they handle the token internally.

---

## 8. Pagination Pattern

The backend supports pagination on the questions endpoint (and others).

### Backend response shape (`PaginatedQuestionResponse`):
```typescript
{
    items: Question[];
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
}
```

### Frontend convention:
- `page.tsx` fetches **only the first page** (default: 10 items)
- The client component (e.g. `QuestionsTable`) handles subsequent pages by calling `/api/questions?page=N&page_size=M`
- Topic filter hits the backend: `?topic_id=X`
- Text search hits the backend: `?search=query` (debounced 400ms)

### Debounced search pattern:
```typescript
const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
        fetchPage(1, pageSize, topicId, value);
    }, 400);
};
```

---

## 9. State Management

**No global state library is installed.** Use the following rules:

| Scenario | Solution |
|---|---|
| State used in **one component only** | `useState` |
| State shared across **sibling components** | Lift state to parent, pass as props |
| State needed **across pages/layouts** | Consider `zustand` (not yet installed — discuss with team first) |
| Theme (dark/light) | `next-themes` (already configured) |

---

## 10. Loader / Loading States

### Root loading (all pages)
`app/loading.tsx` — automatically shown by Next.js for every route while the server component fetches data. **Do not delete this file.**

### The `<Loader>` component (`components/loader.tsx`)

Three variants:

```tsx
// 1. Full-page branded loader (after login redirect, or in loading.tsx)
<Loader fullPage label="Loading your dashboard..." />

// 2. Inline spinner (inside buttons during submit)
<Loader size="sm" label="Saving..." />

// 3. Full-screen overlay (blurred backdrop)
<Loader fullScreen label="Please wait..." />
```

### Button loading pattern:
```tsx
const [isLoading, setIsLoading] = useState(false);

<Button disabled={isLoading}>
    {isLoading ? <Loader size="sm" label="Saving..." /> : "Save"}
</Button>
```

### Table/list loading overlay pattern:
```tsx
<div className="relative">
    {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
            <Loader size="lg" />
        </div>
    )}
    {/* table content */}
</div>
```

---

## 11. UI Component Conventions

> ✅ **Rule: Always use shadcn/ui components. Never build custom UI components from scratch.**

All UI must be built using the components in `components/ui/` (shadcn).  
Do **not** use raw `<div>`, `<button>`, `<input>`, `<select>`, or `<table>` elements directly — always reach for the shadcn equivalent first.

### Available shadcn components

| Need | Use |
|---|---|
| Button / link-button | `<Button>` |
| Text input | `<Input>` |
| Form label | `<Label>` |
| Card container | `<Card>`, `<CardHeader>`, `<CardContent>` |
| Data table | `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>` |
| Tag / chip | `<Badge>` |
| Alert / error | `<Alert>`, `<AlertDescription>` |
| Toast | `toast.success()` / `toast.error()` via `sonner` |
| Dialog / modal | `<Dialog>` |
| Dropdown | `<DropdownMenu>` |

### Other conventions

- Use `lucide-react` for **all** icons — no other icon library
- The `Button` component uses `nativeButton={false} render={<Link href="..." />}` for link-buttons

```tsx
// ✅ Link styled as button (correct)
<Button nativeButton={false} render={<Link href="/questions" />}>
    View Questions
</Button>

// ✅ Destructive action
<Button variant="destructive" onClick={handleDelete}>Delete</Button>

// ✅ Icon-only button
<Button variant="outline" size="icon"><Trash2 className="h-4 w-4" /></Button>

// ❌ Never do this — raw HTML
<button className="bg-red-500 text-white px-4 py-2">Delete</button>
<input type="text" className="border rounded px-2" />
```

---

## 12. How to Add a New Feature (Checklist)

### New backend endpoint
1. Add model in `question_genarated_api/app/models/`
2. Add schema in `question_genarated_api/app/schemas/`
3. Add controller method in `question_genarated_api/app/controllers/`
4. Add route in `question_genarated_api/app/routes/`
5. Create a migration with Alembic if schema changes

### New frontend page
1. Create `app/[feature]/page.tsx` (Server Component)
   - Add auth guard at the top
   - Fetch initial data using services
2. Create `app/[feature]/loading.tsx` ONLY if you need a custom message — otherwise the root loader handles it
3. Create `app/[feature]/[feature-name].tsx` (Client Component) if interactivity is needed
4. Add a service function in `app/services/[resource].ts` if no service exists yet
5. If client component needs to mutate data, add an API route in `app/api/[resource]/route.ts` using `createBackendProxy`

### New service function
→ See [Section 5](#5-service-layer--how-to-fetch-data)

### New API proxy route
→ See [Section 6](#6-api-routes-nextjs-proxy-layer)

---

## 13. Common Mistakes to Avoid

| ❌ Don't do this | ✅ Do this instead |
|---|---|
| Raw `<button>`, `<input>`, `<table>`, `<div>` for UI | Use shadcn components (`<Button>`, `<Input>`, `<Table>`, `<Card>`) |
| Custom CSS component from scratch | Check `components/ui/` first — it probably already exists |
| `const token = cookieStore.get("access_token")` in `page.tsx` then fetch manually | Use `services/*.ts` functions |
| `import { getApiUrl } from "../lib/api-url"` in page files | Use services |
| Manual `fetch + Authorization header` in API routes | Use `createBackendProxy()` |
| Client-side pagination (slice an array in state) | Use backend pagination via `page` & `page_size` params |
| Filtering a full list client-side across pages | Use backend query params (`search`, `topic_id`) with debounce |
| `<Loader2 className="animate-spin" />` inline | Use `<Loader size="sm" />` from `components/loader.tsx` |
| Creating inline loading spinners per component | Use `app/loading.tsx` for page-level, `<Loader>` for inline |
| Loading the entire question bank into a page | Use `getAllQuestions(page, pageSize, topicId, filters)` and load results on demand |
| Adding global state without team discussion | Start with `useState` + prop drilling, escalate if needed |

---

*Last updated: 2026-08-15 by Subhadip's team*
