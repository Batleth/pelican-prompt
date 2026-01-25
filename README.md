<div align="center">
  <img src="build/icons/pelicanprompt.png" alt="Pelican Prompt Logo" width="120" height="120" />

  # Pelican Prompt

  **A powerful, file-based prompt management tool for the modern AI workflow.**

  [Getting Started](#getting-started) • [Features](#features) • [Philosophy](#philosophy) • [Tech Stack](#tech-stack)

</div>

---

> [!NOTE]
> Pelican Prompt is designed for users who want full control over their prompt library, storing them as simple text files that can be versioned, synced, and edited anywhere.

## Getting Started

Follow these steps to get Pelican Prompt running on your local machine.

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** (v7 or higher)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/yourusername/pelican-prompt.git
    cd pelican-prompt
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Start the application**
    ```bash
    npm start
    ```

> [!TIP]
> The application keeps your prompts in a local folder. You can configure this location in the settings to point to a Dropbox, iCloud, or Git folder for automatic syncing across devices.

## Features

### ⚡ Unified Path System
Organize your prompts with a powerful dot-notation system (`category.subcategory.name`). Pelican Prompt automatically handles the hierarchy, letting you think in concepts, not folders.

### 🧩 Reusable Partials
Stop repeating yourself. specific definitions, personas, or formatting rules into **Partials** and include them dynamically in any prompt using Handlebars syntax:
```handlebars
{{> personas.senior_dev}}

Review the following code...
```

### 🧠 Smart Autocomplete
The editor knows your library. Whether you're typing a prompt path or including a partial, Pelican Prompt provides instant, context-aware suggestions to keep your structure consistent.

### 🔍 Lightning Fast Search
Built on **Lunr.js**, search is local, instant, and typo-tolerant. Find prompts by title, tag, or content content immediately.

### 💎 Keyboard Centric
optimized for flow.
- `Cmd/Ctrl + K`: Quick Search
- `Cmd/Ctrl + N`: New Prompt
- `Cmd/Ctrl + S`: Save
- `Esc`: Close

## Philosophy

Pelican Prompt is built on three core principles:

1.  **File System as Truth**: Your prompts are just text files. No database lock-in.
2.  **Composition over Repetition**: Small, reusable parts create powerful, complex prompts.
3.  **Speed**: Every interaction should feel instantaneous.

## Tech Stack

- **Framework**: [Electron](https://www.electronjs.org/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Search**: [Lunr.js](https://lunrjs.com/)
- **Storage**: [electron-store](https://github.com/sindresorhus/electron-store) & Native File System

## Project Structure

```
pelican-prompt/
├── src/
│   ├── main/          # Electron main process (OS interactions)
│   └── renderer/      # UI code (React-like structure)
│       ├── editor/    # Prompt editor logic
│       ├── search/    # Search window & results
│       └── partials/  # Partials management
└── example-prompts/   # Sample library to get started
```
