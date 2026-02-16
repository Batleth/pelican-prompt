<div align="center">
  <img src="build/icons/pelicanprompt.png" alt="Pelican Prompt Logo" width="120" height="120" />

  # Pelican Prompt

  > A powerful, file-based prompt management tool for the modern AI workflow.

  [![Version](https://img.shields.io/github/v/release/Batleth/pelican-prompt)](https://github.com/Batleth/pelican-prompt/releases)
  [![License](https://img.shields.io/github/license/Batleth/pelican-prompt)](LICENSE)

  [Features](#what-is-pelican-prompt) • [Getting Started](#-getting-started) • [Contribution](#-for-developers-contribution-guide)

</div>

---

## 🌟 For Users: Get Started

### <a id="what-is-pelican-prompt"></a>What is Pelican Prompt?
Pelican Prompt acts as your **local library for prompts**. It solves the chaos of managing prompts across different services and tools, like ChatGPT, Claude, MicrosoftCopilot or even your own custom tools. The GenAI landscape is moving fast and tools are changing rapidly, but Pelican Prompt is here to help you manage your prompts in a simple and efficient way.

* **Structured Storage:** Organize prompts and partials in a standard file system.
* **Reusable Components:** Define "partials" (like `tones/professional.md`) and import them anywhere using `{> tones.professional}`.
* **Instant Customization:** Auto-detects variables (`{name}`) and provides a clean UI to fill them before copying.
* **Shareable Prompts:** Generate a compressed string of your prompt to paste directly into team chats.

### <a id="getting-started"></a>📥 How to Install
We provide pre-built binaries for ease of use.

1.  Navigate to the **[Releases Page](https://github.com/Batleth/pelican-prompt/releases)**.
2.  Download the latest version for your OS (Windows `.exe`, macOS `.dmg`, or Linux `.deb/.rpm`).
3.  **Installation Note:** Since this is an independent project, you may need to:
    * **Windows:** Click "More Info" -> "Run Anyway" on SmartScreen.
    * **macOS:** Right-click the app and select "Open" to bypass the "unidentified developer" warning.

### 🚀 Quick Start
Start managing your prompts in 3 steps:

1. **Set Workspace:** On first launch, select a folder to store your prompts (or let PelicanPrompt create one).
2. **Create a Prompt:** Create a file named `email.welcome.md` and write:
   ```markdown
   Subject: Welcome {name}!
   We are glad you joined {company}.
   ```
3. **Use It:** Search for "welcome", press `Enter`, fill in the `name` and `company` fields, and copy the result to your clipboard.

### 4. Use Partials
Open the Partials Libary with the shortcut `Ctrl+P`.
Create a file named `tones.professional.md` and write:
```markdown
Be professional and concise.
```
Then use it in your prompt:
```markdown
Subject: Welcome {name}!
{> tones.professional}
We are glad you joined {company}.
```

You can also use the partial selection by defining it like this:
```markdown
Subject: Welcome {name}!
{> tones.* }
We are glad you joined {company}.
```
This will create a selection of all partials in the tones folder and let you select one of them to be inserted into the prompt.
---

## <a id="contribution"></a>🛠 For Developers: Contribution Guide

### 🏗 Development Setup
To run this project locally, ensure you have **Node.js 20+** installed.

1. **Clone & Install:**
   ```bash
   git clone https://github.com/Batleth/pelican-prompt.git
   cd pelican-prompt
   npm install
   ```

2. **Run Dev Environment:**
   ```bash
   npm start
   ```
   *This runs `electron-forge start` with hot module replacement.*

### 🧪 Testing & Building

* **Run Tests:**
  ```bash
  npm test
  ```
* **Build Production Binaries:**
  ```bash
  npm run make
  ```
  *Note: Binaries will be output to the `/out` folder.*

### 🤝 How to Contribute

We love PRs! Here is how to help:

1. **Check Issues:** Look for "good first issue" tags.
2. **Branching:** Create a feature branch (`git checkout -b feature/AmazingFeature`).
3. **Style:** Follow the existing linting rules (`npm run lint`).
4. **Submit:** Open a Pull Request with a clear description of changes.

---

built by [Batleth](https://github.com/Batleth)
