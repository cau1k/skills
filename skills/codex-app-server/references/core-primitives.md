# Core primitives

- **Thread**: A conversation between a user and the Codex agent. Threads contain turns.
- **Turn**: A single user request and the agent work that follows. Turns contain items and stream incremental updates.
- **Item**: A unit of input or output (user message, agent message, command runs, file change, tool call, and more).

Use the thread APIs to create, list, or archive conversations. Drive a conversation with turn APIs and stream progress via turn notifications.
