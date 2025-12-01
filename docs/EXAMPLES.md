# Usage Examples

This document shows real-world examples of using My Code Assistant.

## Example 1: Understanding a New Project

### Scenario
You just joined a team and need to understand the codebase structure.

### Commands

```bash
$ mca init
🚀 My Code Assistant - Project Initialization

? Project name: our-app
? Project description: Real-time chat application
? Folders to index: src, docs
? LLM model name: llama3.2
✓ Project initialized successfully!

$ mca index
📚 Indexing Project

Indexing project...
✓ Indexing completed!
  Files indexed: 145
  Chunks created: 1,247
  Total size: 285.42 KB

$ mca chat
💬 Starting Chat

🤖 My Code Assistant

Project: our-app
Branch: main
Files: 145, LOC: 12345, Chunks: 1247
Recent commits: Add real-time notifications

Type /help for commands or ask a question
```

### Chat Interaction

```
You: What's the overall architecture of this project?
Assistant: Based on the codebase, our-app uses a layered architecture:

[1] src/api/ - Express routes and controllers
[2] src/services/ - Business logic for chat, users, messages
[3] src/models/ - Database models
[4] src/middleware/ - Authentication and logging

Sources:
  [1] src/api/index.ts (similarity: 92.3%)
  [2] src/services/chatService.ts (similarity: 88.1%)

Confidence: 90%

You: How is user authentication implemented?
Assistant: Authentication uses JWT tokens stored in httpOnly cookies:

[1] JWT generation happens in src/auth/jwtService.ts
[2] Middleware checks tokens in src/middleware/auth.ts
[3] Routes are protected using requireAuth decorator

Sources:
  [1] src/auth/jwtService.ts (similarity: 95.2%)
  [2] src/middleware/auth.ts (similarity: 91.7%)

Confidence: 93%

You: /history
Conversation History:
User: What's the overall architecture of this project?
Assistant: Based on the codebase, our-app uses a layered architecture...
User: How is user authentication implemented?
Assistant: Authentication uses JWT tokens...
```

## Example 2: Debugging an Issue

### Scenario
A bug is reported: "Chat messages sometimes don't save to the database"

### Chat Interaction

```
You: We have a bug where chat messages sometimes don't save. Let me understand the flow.
Assistant: The message saving flow goes through these steps:

[1] src/api/messages.ts - Express POST endpoint receives message
[2] src/services/messageService.ts - Validates and processes the message
[3] src/models/Message.ts - Mongoose model saves to MongoDB

Sources:
  [1] src/api/messages.ts (similarity: 87.3%)
  [2] src/services/messageService.ts (similarity: 85.1%)

Confidence: 88%

You: Is there any error handling in the messageService.saveMessage function?
Assistant: Looking at the messageService, the saveMessage function:
- Validates message content [1]
- Saves to database [2]
- Does NOT have a try-catch block [3]

This could be the issue - unhandled database errors!

Sources:
  [1] src/services/messageService.ts#L45-55 (similarity: 92.1%)
  [2] src/services/messageService.ts#L56-60 (similarity: 89.7%)
  [3] src/services/messageService.ts (similarity: 91.3%)

Confidence: 94%

You: What should we do to fix it?
Assistant: You should wrap the database operation in try-catch:

```typescript
async saveMessage(message) {
  try {
    // validation code
    await Message.create(message); // add error handling here
  } catch (error) {
    logger.error('Failed to save message:', error);
    throw new SaveMessageError('Unable to save message');
  }
}
```

Add similar error handling in [1] src/api/messages.ts route handler.

Sources:
  [1] src/api/messages.ts (similarity: 84.2%)

Confidence: 87%
```

## Example 3: Adding a New Feature

### Scenario
You need to add email notifications when someone mentions you in a chat.

### Chat Interaction

```
You: I need to add email notifications when someone mentions me. Where should I start?
Assistant: For mentions feature, you'll need to:

1. Detect mentions in messages - parse @username syntax in [1]
2. Create notification records in [2]
3. Send emails via [3]

Existing mention detection code: [1] src/services/messageService.ts#L120-135
Notification model: [2] src/models/Notification.ts
Email service: [3] src/services/emailService.ts (already exists!)

Sources:
  [1] src/services/messageService.ts (similarity: 89.4%)
  [2] src/models/Notification.ts (similarity: 85.2%)
  [3] src/services/emailService.ts (similarity: 81.7%)

Confidence: 91%

You: Show me how the existing email service works
Assistant: The emailService has these methods:

- sendEmail(to, subject, html) - Send single email [1]
- sendBulk(recipients, template) - Send to multiple [2]
- validateEmail(email) - Validate email format [3]

Example usage from password reset:
```typescript
await emailService.sendEmail(
  user.email,
  'Password Reset',
  template
);
```

Sources:
  [1] src/services/emailService.ts#L10-25
  [2] src/services/emailService.ts#L27-40
  [3] src/services/emailService.ts#L42-50

Confidence: 93%

You: Where should I add the mention notification logic?
Assistant: Best place is in messageService.saveMessage() [1]:

After saving message, extract mentions and create notifications:

1. Use existing regex in [1] to find @mentions
2. Look up users by username [2]
3. Create Notification records [3]
4. Send emails via emailService [4]

This keeps mention logic centralized.

Sources:
  [1] src/services/messageService.ts#L45-70
  [2] src/models/User.ts#L15-30
  [3] src/models/Notification.ts#L1-10
  [4] src/services/emailService.ts#L10-25

Confidence: 89%
```

## Example 4: Quick Context Before Coding

### Scenario
You're about to write code and want context about related modules.

```bash
$ mca chat

🤖 My Code Assistant

Project: our-app
Branch: feature/email-notifications
Files: 145, LOC: 12345, Chunks: 1247
Recent commits: Add mention detection logic

Type /help for commands or ask a question

You: /context
Project Context:
  Name: our-app
  Description: Real-time chat application
  Branch: feature/email-notifications
  Files: 145
  LOC: 12345
  Chunks: 1247

  Recent Commits:
    - Add mention detection logic (you, 10m ago)
    - Fix message save bug (Maria, 1h ago)
    - Refactor auth service (John, 2h ago)

You: What's in the User model?
Assistant: The User model has these fields:

- id (ObjectId)
- username (String, unique)
- email (String)
- passwordHash (String)
- avatar (String)
- createdAt (Date)
- updatedAt (Date)
- preferences (Object)

See full schema in [1] src/models/User.ts

Sources:
  [1] src/models/User.ts (similarity: 94.2%)

Confidence: 95%
```

## Example 5: Monorepo Navigation

### Scenario
Working with a monorepo containing multiple packages.

### Configuration

```bash
$ cat projectConfig.json
{
  "projectName": "my-monorepo",
  "paths": {
    "includeFolders": ["packages", "apps", "shared"]
  },
  ...
}

$ mca index
✓ Indexing completed!
  Files indexed: 534 (packages: 234, apps: 189, shared: 111)
  Chunks created: 5,243
```

### Chat Interaction

```
You: What's the relationship between @monorepo/ui and @monorepo/web?
Assistant: @monorepo/web depends on @monorepo/ui for components:

[1] packages/web/package.json imports @monorepo/ui
[2] packages/ui exports Button, Card, Form components
[3] packages/web/src/pages uses Button, Card from @monorepo/ui

Sources:
  [1] packages/web/package.json (similarity: 87.3%)
  [2] packages/ui/src/index.ts (similarity: 91.2%)
  [3] packages/web/src/pages/Chat.tsx (similarity: 85.1%)

Confidence: 89%

You: Which files use the shared utilities?
Assistant: Multiple packages import from @monorepo/shared:

- packages/web/src/ imports utils [1]
- packages/api/src/ imports validators [2]
- packages/mobile/src/ imports helpers [3]

Most used: shared/src/validators.ts (imported 23 times)

Sources:
  [1] packages/web/src/index.ts (similarity: 82.1%)
  [2] packages/api/src/index.ts (similarity: 80.3%)
  [3] packages/mobile/src/index.ts (similarity: 78.9%)

Confidence: 85%
```

## Tips for Best Results

1. **Be specific**: "How does authentication work?" vs "Show me src/auth/jwtService.ts"
2. **Use context**: Reference previous answers in follow-up questions
3. **Ask follow-ups**: If answer is incomplete, ask for more details
4. **Use /git**: Check recent changes to understand current state
5. **Clear history**: Use `/clear` to start fresh investigation
6. **Ask about patterns**: "What's the error handling pattern?" vs just one file

## Common Question Types

### Understanding
- "What's the architecture?"
- "How does X work?"
- "Explain the Y module"

### Navigation
- "Where is the X feature?"
- "Which file handles Z?"
- "Show me the authentication flow"

### Implementation
- "How do I add feature X?"
- "Show me an example of Y pattern"
- "What's the best way to do Z?"

### Debugging
- "Why does X fail?"
- "Show me error handling for Y"
- "Where's the bug in Z?"

### Context
- "/git" - See recent changes
- "/history" - See conversation
- "/context" - See project stats
