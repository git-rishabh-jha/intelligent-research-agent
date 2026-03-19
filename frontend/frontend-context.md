# FRONTEND CONTEXT DOCUMENT
Project: AI Research Assistant
Author: Rishabh Jha
Architecture: React + Vite + TypeScript + TailwindCSS

---

# 1️⃣ TECH STACK

- React (Vite setup)
- TypeScript
- TailwindCSS
- Functional Components
- React Hooks (useState)
- No routing library currently configured
- No global state manager (Redux/Zustand not used)
- No backend integration yet
- Static demo data only

---

# 2️⃣ PROJECT STRUCTURE

src/
│
├── components/
│   ├── chat/
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatWindow.tsx
│   └── ui/
│
├── hooks/
├── layouts/
│   └── MainLayout.tsx
│
├── lib/
├── pages/
│   ├── Chat.tsx
│   └── dashboard.tsx (placeholder / planned)
│
├── services/
│
├── App.tsx
├── main.tsx
├── index.css

---

# 3️⃣ LAYOUT ARCHITECTURE

## MainLayout.tsx

MainLayout wraps all page content.

Structure:

<div class="min-h-screen bg-slate-900 text-slate-100 flex">
   Sidebar (w-64 fixed width)
   Main Content (flex-1)
</div>

### Sidebar Characteristics

- Width: w-64
- Background: bg-slate-950
- Border: border-r border-slate-800
- Persistent layout
- Contains:
  - "Doc Dashboard" button (highlighted emerald button)
  - "+ New Chat" button
  - Static Recent Chats list
  - Bottom user profile section

### Main Content Area

<main class="flex-1 p-8">
   {children}
</main>

IMPORTANT:
MainLayout controls overall height using `min-h-screen`.
Child components must NOT use `vh` based heights.
Use `flex-1` instead.

---

# 4️⃣ CHAT SYSTEM ARCHITECTURE

There are two chat implementations:

## A) App.tsx (Landing + Active Chat Logic)

App.tsx manages a local state:

const [chatStarted, setChatStarted] = useState(false)

### Landing State

- Centered title "Research Assistant"
- ChatInput only
- Triggered when chatStarted = false

When first message is sent:
onFirstMessage() triggers state change

---

### Active Chat State

Structure:

<div class="h-full flex flex-col">
   Title
   <div class="flex-1 overflow-y-auto">
       ChatWindow
   </div>
   ChatInput
</div>

Rules:
- ChatWindow scrolls
- Input stays at bottom
- No viewport height hacks

---

## B) pages/Chat.tsx

Alternative page-based chat layout:

<MainLayout>
   Header
   ChatWindow
   ChatInput
</MainLayout>

Used for page-based architecture.

---

# 5️⃣ CHAT COMPONENTS

## ChatInput.tsx

Props:
onFirstMessage?: () => void

Responsibilities:
- Manage local message state
- Trigger chat start
- Clear input after sending

Styling:
- bg-slate-800
- border-slate-700
- emerald send button
- rounded-2xl input container

---

## ChatMessage.tsx

Props:
role: "user" | "assistant"
content: string

Behavior:
- User messages → right aligned
- Assistant messages → left aligned

Styling:
User:
- bg-indigo-600 or bg-cyan-600
- text-white

Assistant:
- bg-slate-800
- text-emerald-300
- font-mono

Design intention:
Assistant feels like terminal AI output.

---

## ChatWindow.tsx

Structure:

<div class="flex flex-col flex-1 overflow-y-auto space-y-6 pr-4">

Contains static demo messages.

IMPORTANT:
Uses flex-1 for layout stability.
Must remain scrollable container only.

---

# 6️⃣ DESIGN SYSTEM

Theme: Dark AI Hacker Dashboard

Color Palette:
- Background: slate-900
- Sidebar: slate-950
- Borders: slate-800
- Accent: emerald-500
- Primary text: slate-100
- Secondary text: slate-400

UI Characteristics:
- Rounded corners (rounded-lg / rounded-2xl)
- Subtle hover states
- Monospace assistant text
- Minimal gradients
- Clean dashboard aesthetic

---

# 7️⃣ NAVIGATION STATUS

Currently:
❌ No routing library implemented.
❌ "Doc Dashboard" button has no navigation logic.
❌ pages/dashboard.tsx exists but not wired.

Future requirement:
Implement React Router DOM for navigation:

Planned routes:
"/" → Chat
"/dashboard" → Document Dashboard

MainLayout must wrap routes.

---

# 9️⃣ LAYOUT RULES (STRICT)

1. Do NOT use vh inside child components.
2. Use flex-1 for dynamic height.
3. Sidebar must remain persistent.
4. Only main content scrolls.
5. Keep Tailwind-only styling.
6. Avoid inline CSS.
7. Avoid hardcoded heights unless necessary.
8. Maintain dark aesthetic consistency.

---

# 🔟 CURRENT LIMITATIONS

- No API layer connected
- No document upload feature
- No persistent chat history
- No routing system
- No global state management
- Static demo data only

---


END OF FRONTEND CONTEXT