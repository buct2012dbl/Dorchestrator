# Coding Agent System

Production-grade coding agent system with multi-agent collaboration, deep codebase understanding, and support for multiple LLM providers.

## Features

- **Multi-Agent Architecture**: Specialized agents for coding, exploration, planning, and review
- **Deep Context Management**: Smart context selection with 180K+ token windows
- **Multi-Provider Support**: Anthropic, OpenAI, Ollama, and custom OpenAI-compatible APIs
- **Custom Provider Configuration**: JSON-based provider setup with fallback chains
- **Parallel Execution**: Multiple agents working simultaneously
- **Rich Tool System**: File operations, shell commands, code search, agent communication
- **Session Management**: Isolated sessions with independent histories
- **Event-Driven**: Message bus for loose coupling and extensibility
- **Comprehensive Testing**: 196 unit tests covering all features

## Quick Start

### Installation

```bash
cd coding-agent
npm install
```

### Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

### Run

Start the interactive agent:

```bash
npm run dev start
```

Or use the built version:

```bash
npm run build
npm start start
```

## Usage

### Interactive Mode

```bash
npm run dev start
```

This starts a REPL where you can chat with the coding agent:

```
You: Read the package.json file
Agent: [reads and displays content]

You: Create a new file called test.js with a hello world function
Agent: [creates file]

You: exit
```

### Commands

- `exit` or `quit` - Exit the REPL
- `stats` - Show system statistics
- `clear` - Clear the screen

### List Available Agents

```bash
npm run dev list-agents
```

### List Available Models

```bash
npm run dev list-models
```

## Configuration

### Agent Configuration

Edit `config/agents.json` to customize agents:

```json
{
  "llm": {
    "providers": {
      "anthropic": {
        "type": "anthropic",
        "apiKey": "${ANTHROPIC_API_KEY}"
      },
      "deeprouter": {
        "type": "openai-compatible",
        "apiKey": "${DEEPROUTER_API_KEY}",
        "baseUrl": "https://api.deeprouter.ai/v1",
        "models": ["deepseek-chat", "qwen-plus"]
      }
    },
    "fallbackChain": ["anthropic", "openai", "deeprouter"],
    "modelAliases": {
      "fast": "claude-sonnet-4-6",
      "smart": "claude-opus-4-6"
    }
  },
  "agents": [
    {
      "id": "main-coder",
      "type": "coding",
      "name": "Main Coding Agent",
      "model": "claude-sonnet-4-6",
      "provider": "anthropic",
      "temperature": 0.7,
      "tools": ["read", "write", "edit", "bash", "grep", "glob"]
    }
  ]
}
```

### Supported Models

**Anthropic:**
- claude-opus-4-6
- claude-sonnet-4-6
- claude-haiku-4-5

**OpenAI:**
- gpt-4-turbo
- gpt-4
- gpt-3.5-turbo

**Ollama (local):**
- codellama:13b
- deepseek-coder:6.7b
- mistral:7b

**Custom Providers:**
- Any OpenAI-compatible API (DeepRouter, OpenRouter, Together, etc.)
- Configure via `llm.providers` in config

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Interface                           │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│                  Agent Orchestrator                          │
│  • Session Management                                        │
│  • Agent Registry & Lifecycle                               │
│  • Message Router & Bus                                     │
└────┬──────────┬──────────┬──────────────────────────────────┘
     │          │          │
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Agent A │ │ Agent B │ │ Agent C │
└─────────┘ └─────────┘ └─────────┘
```

## Development

### Project Structure

```
coding-agent/
├── src/
│   ├── core/           # Core orchestration
│   ├── agent/          # Agent implementations
│   ├── tools/          # Tool system
│   ├── llm/            # LLM providers
│   ├── context/        # Context management
│   ├── config/         # Configuration
│   ├── monitoring/     # Logging and metrics
│   ├── errors/         # Error handling
│   └── cli/            # CLI interface
├── config/             # Configuration files
└── tests/              # Unit tests
    └── unit/           # 196 unit tests
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Coverage

- **15 test files** with **196 tests**
- Core infrastructure (orchestrator, registry, sessions)
- Agent system (base agent, coding agent, specialized agents)
- Provider system (multi-provider, fallback, custom providers)
- Tool system (registry, execution, formatting)
- Context management (shared store, message bus)
- Configuration (loader, validation, env substitution)

### Build

```bash
npm run build
```

## Roadmap

- [x] Phase 1: Core infrastructure and basic agent
- [x] Phase 2: Context management with codebase indexing
- [x] Phase 3: Multi-agent communication and parallel execution
- [x] Phase 4: Custom provider configuration system
- [x] Comprehensive unit test suite (196 tests)
- [ ] Phase 5: Integration tests and E2E testing
- [ ] Phase 6: Production hardening and optimization

## License

MIT
