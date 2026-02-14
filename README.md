<div align="center">
  <img src="build/icons/pelicanprompt.png" alt="Pelican Prompt Logo" width="120" height="120" />

  # Pelican Prompt

  **A powerful, file-based prompt management tool for the modern AI workflow.**

  [Features](#features) • [Getting Started](#getting-started) • [Contribution](#contribution)

</div>

# Features
PelicanPrompt acts as your **local IDE for prompts**, offering:
- **Structured Storage**: Organize prompts and partials in a standard file system.
- **Reusable Components**: Define "partials" (like `tones/professional.md`) and import them anywhere.
- **Instant Customization**: Auto-detect variables (`{name}`) and fill them via a clean UI before copying.
- **Shareable Prompts**: Share prompts by copying a compressed string and paste into your teams chat.
---

# Getting Started
## User Guide
### Installation
> [!NOTE]
> Currently in active development. Build from source or check [Releases](https://github.com/Batleth/pelican-prompt/releases) and Download App for Windows, Linux and MacOS.

### Quick Start
1. **Set Workspace**: On first launch, select a folder to store your prompts (or let PelicanPrompt create one).
2. **Create a Partial**: Go to "Partials" and create `tones.active`. Write: "Use an active voice and short sentences."
3. **Create a Prompt**: Create a new prompt `email.welcome`. Write:
   ```markdown
   Subject: Welcome {name}!
   {> tones.active}
   We are glad you joined {company}.
   ```
4. **Use It**: Search for "welcome", press `Enter`, fill in `name` and `company`, and copy the result to your clipboard. Or copy it with placeholders and fill them in later.

---

# Contribution
## Environment Setup
Clone the repository and install dependencies.
```bash
git clone https://github.com/Batleth/pelican-prompt.git
cd pelican-prompt
npm install
```

## Local Execution
Run the application in development mode with hot-reloading.
```bash
npm start
```

## Quality Assurance
Run the test suite to ensure stability.
```bash
# Run Unit Tests
npm test

# Run Linter
npm run lint
```

## Build Pipeline
Package the application for production (creates an executable in `out/` folder).
```bash
npm run make
```

---

## Tech Stack
- **Core**: Electron, TypeScript
- **Frontend**: React 19, Vite
- **UI**: UI5 Web Components, Monaco Editor
- **Search**: Lunr.js (Local full-text search)
- **State**: Electron Store (Persistence)
