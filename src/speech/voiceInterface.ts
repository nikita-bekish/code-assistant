import chalk from "chalk";
import fs from "fs";
import inquirer from "inquirer";
import { CodeAssistant } from "../codeAssistant.js";
import { SpeechToText } from "./speechToText.js";
import { TextToSpeech } from "./textToSpeech.js";
import { VoiceRecorder } from "./voiceRecorder.js";

export class VoiceInterface {
  private assistant: CodeAssistant;
  private stt: SpeechToText;
  private tts: TextToSpeech;
  private recorder: VoiceRecorder;

  constructor(assistant: CodeAssistant, openaiApiKey?: string) {
    this.assistant = assistant;
    this.stt = new SpeechToText(openaiApiKey);
    this.tts = new TextToSpeech(openaiApiKey, "nova");
    this.recorder = new VoiceRecorder();
  }

  /**
   * Start voice interface loop
   */
  async start(): Promise<void> {
    console.log(chalk.cyan.bold("\n🎙️  God Agent Voice Interface\n"));
    console.log(chalk.gray("━".repeat(60)));
    console.log(chalk.yellow("\nCapabilities:"));
    console.log("  • Voice input with Speech-to-Text (Whisper)");
    console.log("  • Code understanding with RAG");
    console.log("  • MCP Tools integration (Git, CRM, Tasks)");
    console.log("  • Error log analytics");
    console.log("  • Voice output with Text-to-Speech (nova)");
    console.log(chalk.gray("\n" + "━".repeat(60)));
    console.log(chalk.dim("\nPress Ctrl+C to exit\n"));

    // Setup stdin once at start
    this.recorder.setupStdin();

    try {
      // Main loop
      while (true) {
        try {
          // Step 1: Record voice
          console.log(chalk.bold("\n🎤 Ready for your question"));
          const audioPath = await this.recorder.recordWithSpaceTrigger();

          // Step 2: Transcribe
          console.log(chalk.dim("\n⏳ Processing audio..."));
          const question = await this.stt.transcribe(audioPath, "ru");

          // Clean up audio file
          await fs.promises.unlink(audioPath);

          console.log(chalk.green(`\n✓ You: "${question}"`));

          // Check if user wants to exit
          if (
            question.toLowerCase().includes("выход") ||
            question.toLowerCase().includes("exit") ||
            question.toLowerCase().includes("стоп")
          ) {
            console.log(chalk.yellow("\n👋 Goodbye!"));
            await this.tts.speak("До свидания!");
            break;
          }

          // Step 3: Get answer from assistant
          console.log(chalk.dim("\n🤔 Thinking..."));
          const result = await this.assistant.ask(question);

          // Step 4: Display answer
          console.log(chalk.cyan(`\n🤖 Answer:\n`));
          console.log(result.answer);

          if (result.sources && result.sources.length > 0) {
            console.log(chalk.dim("\nSources:"));
            result.sources.forEach((source, i) => {
              console.log(
                chalk.dim(
                  `  [${i + 1}] ${source.source} (${source.similarity}%)`
                )
              );
            });
          }

          // Step 5: Speak answer
          console.log(chalk.dim("\n🔊 Speaking answer..."));
          await this.tts.speak(result.answer);

          console.log(chalk.gray("\n" + "─".repeat(60)));
        } catch (error) {
          console.error(chalk.red("\n❌ Error:"), error);
          await this.tts.speak("Произошла ошибка. Попробуйте ещё раз.");
        }
      }
    } finally {
      // Cleanup stdin when exiting
      this.recorder.cleanupStdin();
    }
  }

  /**
   * Start voice interface with plan confirmation
   */
  async startWithPlanConfirmation(): Promise<void> {
    console.log(
      chalk.cyan.bold("\n🎙️  God Agent Voice Interface (Plan Mode)\n")
    );
    console.log(chalk.gray("━".repeat(60)));
    console.log(chalk.yellow("\nCapabilities:"));
    console.log("  • Voice input with Speech-to-Text (Whisper)");
    console.log("  • Execution plan generation");
    console.log("  • Manual confirmation before execution");
    console.log("  • Code understanding with RAG");
    console.log("  • MCP Tools integration (Git, CRM, Tasks)");
    console.log("  • Voice output with Text-to-Speech (nova)");
    console.log(chalk.gray("\n" + "━".repeat(60)));
    console.log(chalk.dim("\nPress Ctrl+C to exit\n"));

    // Setup stdin once at start
    this.recorder.setupStdin();

    try {
      // Main loop
      while (true) {
        try {
          // Step 1: Record voice
          console.log(chalk.bold("\n🎤 Ready for your question"));
          const audioPath = await this.recorder.recordWithSpaceTrigger();

          // Step 2: Transcribe
          console.log(chalk.dim("\n⏳ Processing audio..."));
          const question = await this.stt.transcribe(audioPath, "ru");

          // Clean up audio file
          await fs.promises.unlink(audioPath);

          console.log(chalk.green(`\n✓ You: "${question}"`));

          // Check if user wants to exit
          if (
            question.toLowerCase().includes("выход") ||
            question.toLowerCase().includes("exit") ||
            question.toLowerCase().includes("стоп")
          ) {
            console.log(chalk.yellow("\n👋 Goodbye!"));
            await this.tts.speak("До свидания!");
            break;
          }

          // Step 3: Create execution plan
          console.log(chalk.dim("\n🤔 Creating execution plan..."));
          const plan = await this.createExecutionPlan(question);

          // Step 4: Display plan
          console.log(chalk.cyan("\n📋 Execution Plan:"));
          plan.steps.forEach((step, i) => {
            console.log(chalk.white(`  ${i + 1}. ${step.description}`));
            console.log(chalk.dim(`     Tool: ${step.tool}`));
          });

          // Step 5: Ask for confirmation
          const { confirmed } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirmed",
              message: "Execute this plan?",
              default: true,
            },
          ]);

          // Restore stdin setup after inquirer (it changes stdin mode)
          this.recorder.setupStdin();

          if (!confirmed) {
            console.log(
              chalk.yellow("\n⏭️  Plan cancelled, moving to next question")
            );
            await this.tts.speak("План отменён");
            continue;
          }

          // Step 6: Execute plan
          console.log(chalk.dim("\n⚙️  Executing plan..."));
          const result = await this.assistant.ask(question);

          // Step 7: Display answer
          console.log(chalk.cyan(`\n🤖 Answer:\n`));
          console.log(result.answer);

          if (result.sources && result.sources.length > 0) {
            console.log(chalk.dim("\nSources:"));
            result.sources.forEach((source, i) => {
              console.log(
                chalk.dim(
                  `  [${i + 1}] ${source.source} (${source.similarity}%)`
                )
              );
            });
          }

          // Step 8: Speak answer
          console.log(chalk.dim("\n🔊 Speaking answer..."));
          await this.tts.speak(result.answer);

          console.log(chalk.gray("\n" + "─".repeat(60)));
        } catch (error) {
          console.error(chalk.red("\n❌ Error:"), error);
          await this.tts.speak("Произошла ошибка. Попробуйте ещё раз.");
        }
      }
    } finally {
      // Cleanup stdin when exiting
      this.recorder.cleanupStdin();
    }
  }

  /**
   * Create execution plan for a question
   */
  private async createExecutionPlan(
    question: string
  ): Promise<{ steps: Array<{ description: string; tool: string }> }> {
    // Simple heuristic-based planning
    const steps: Array<{ description: string; tool: string }> = [];

    // Check what the question is about
    const lowerQuestion = question.toLowerCase();

    if (
      lowerQuestion.includes("код") ||
      lowerQuestion.includes("функци") ||
      lowerQuestion.includes("реализ")
    ) {
      steps.push({
        description: "Search codebase for relevant code",
        tool: "RAG",
      });
      steps.push({
        description: "Analyze code and provide explanation",
        tool: "LLM",
      });
    }

    if (
      lowerQuestion.includes("ошиб") ||
      lowerQuestion.includes("лог") ||
      lowerQuestion.includes("error")
    ) {
      steps.push({
        description: "Load and analyze error logs",
        tool: "RAG (error-logs.json)",
      });
      steps.push({
        description: "Generate statistics and patterns",
        tool: "LLM Analytics",
      });
    }

    if (
      lowerQuestion.includes("git") ||
      lowerQuestion.includes("коммит") ||
      lowerQuestion.includes("commit")
    ) {
      steps.push({
        description: "Query Git repository",
        tool: "MCP Git Server",
      });
      steps.push({
        description: "Format and present results",
        tool: "LLM",
      });
    }

    if (
      lowerQuestion.includes("задач") ||
      lowerQuestion.includes("task") ||
      lowerQuestion.includes("проект")
    ) {
      steps.push({
        description: "Check Tasks API for open tasks",
        tool: "Tasks API",
      });
      steps.push({
        description: "Check Git status",
        tool: "MCP Git",
      });
      steps.push({
        description: "Analyze error logs",
        tool: "RAG",
      });
      steps.push({
        description: "Generate comprehensive project report",
        tool: "LLM",
      });
    }

    // Default: RAG search + LLM answer
    if (steps.length === 0) {
      steps.push({
        description: "Search knowledge base",
        tool: "RAG",
      });
      steps.push({
        description: "Generate answer",
        tool: "LLM",
      });
    }

    return { steps };
  }
}
