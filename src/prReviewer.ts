import { CodeAssistant } from './codeAssistant.js';
import { ProjectConfig } from './types/index.js';

export interface FileChange {
  filename: string;
  patch?: string;
  changes: number;
  additions: number;
  deletions: number;
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'copied';
}

export interface ReviewComment {
  line: number;
  filename: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface CodeReview {
  summary: string;
  issues: ReviewComment[];
  suggestions: string[];
  overallScore: number; // 0-100
}

/**
 * PR Code Reviewer
 * Analyzes pull request changes using CodeAssistant
 */
export class PRReviewer {
  private assistant: CodeAssistant;

  constructor(config: ProjectConfig) {
    this.assistant = new CodeAssistant(config);
  }

  /**
   * Initialize the reviewer
   */
  async initialize(): Promise<void> {
    await this.assistant.initialize();
  }

  /**
   * Review pull request changes
   */
  async reviewChanges(files: FileChange[]): Promise<CodeReview> {
    const issues: ReviewComment[] = [];
    const suggestions: string[] = [];

    // Group files by type
    const codeFiles = files.filter(f => this._isCodeFile(f.filename));
    const docFiles = files.filter(f => this._isDocFile(f.filename));

    console.log(`Reviewing ${codeFiles.length} code files and ${docFiles.length} doc files...`);

    // Analyze each code file
    for (const file of codeFiles) {
      if (!file.patch) continue;

      const fileIssues = await this._analyzeFile(file);
      issues.push(...fileIssues);
    }

    // Check documentation changes
    if (docFiles.length > 0) {
      const docSuggestions = await this._analyzeDocs(docFiles);
      suggestions.push(...docSuggestions);
    }

    // Generate summary
    const summary = this._generateSummary(issues, suggestions);

    // Calculate score
    const overallScore = this._calculateScore(issues);

    return {
      summary,
      issues,
      suggestions,
      overallScore,
    };
  }

  /**
   * Analyze a single file for issues
   */
  private async _analyzeFile(file: FileChange): Promise<ReviewComment[]> {
    const issues: ReviewComment[] = [];

    // Get project context via RAG
    const contextQuery = `What are the coding standards, architectural patterns, and style guidelines for this project? Focus on ${this._getFileType(file.filename)} files.`;
    const contextResult = await this.assistant.ask(contextQuery);
    const projectContext = contextResult.answer;

    const reviewPrompt = `
You are an expert code reviewer for this TypeScript/JavaScript project.

PROJECT CONTEXT:
${projectContext}

TASK: Review this code change for real, actionable issues.

File: ${file.filename}
Changes: +${file.additions} -${file.deletions} lines

Diff:
\`\`\`diff
${file.patch}
\`\`\`

IMPORTANT GUIDELINES:
- Only flag REAL issues, not style preferences
- Environment variables and secrets are safe - they're injected at runtime, not hardcoded
- Configuration objects are normal and expected
- Don't flag issues about "hardcoded values" in configs
- Focus on: actual bugs, security vulnerabilities, logic errors, performance problems
- Ignore: naming preferences, property descriptions, generic security warnings

Find ONLY critical issues:
1. Logic errors or bugs that break functionality
2. Real security vulnerabilities (not about env vars)
3. Performance problems in algorithms
4. Type safety issues that TypeScript would catch
5. Missing error handling for actual errors (not every operation)
6. Race conditions or async issues

Return response as JSON array:
[
  {
    "line": <approximate line number>,
    "severity": "error|warning|info",
    "message": "<specific, actionable issue>"
  }
]

Return empty array [] if no real issues found.
`;

    try {
      const result = await this.assistant.ask(reviewPrompt);

      // Try to parse JSON response
      const jsonMatch = result.answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const issuesData = JSON.parse(jsonMatch[0]) as Array<{
          line: number;
          severity: 'error' | 'warning' | 'info';
          message: string;
        }>;

        // Filter out false positives
        const filtered = issuesData.filter(issue =>
          !this._isFalsePositive(issue.message)
        );

        return filtered.map(issue => ({
          line: issue.line,
          filename: file.filename,
          severity: issue.severity,
          message: issue.message,
        }));
      }
    } catch (error) {
      console.warn(`Failed to analyze file ${file.filename}:`, error);
    }

    return issues;
  }

  /**
   * Analyze documentation changes
   */
  private async _analyzeDocs(files: FileChange[]): Promise<string[]> {
    const suggestions: string[] = [];

    const docPrompt = `
You are a technical documentation expert. Review these documentation file changes:

Files changed: ${files.map(f => f.filename).join(', ')}

Evaluate:
1. Clarity and completeness of explanations
2. Accuracy of examples
3. Logical structure and organization
4. Missing or outdated information

Provide 2-3 actionable suggestions to improve the documentation.

Return ONLY valid JSON array:
[
  "First suggestion - specific and actionable",
  "Second suggestion - clear and concise",
  "Third suggestion - focused on improvements"
]

Return empty array [] if documentation is excellent.
`;

    try {
      const result = await this.assistant.ask(docPrompt);

      // Try to parse JSON response
      const jsonMatch = result.answer.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const suggestionsData = JSON.parse(jsonMatch[0]) as string[];

        // Filter out low-quality suggestions
        const filtered = suggestionsData.filter(s =>
          s &&
          s.length > 10 &&
          !s.toLowerCase().includes('user:') &&
          !s.toLowerCase().includes('you:') &&
          !s.toLowerCase().includes('review these') &&
          !s.toLowerCase().includes('suggest improvements')
        );

        suggestions.push(...filtered.slice(0, 3));
      }
    } catch (error) {
      console.warn('Failed to analyze documentation:', error);
    }

    return suggestions;
  }

  /**
   * Generate review summary
   */
  private _generateSummary(issues: ReviewComment[], suggestions: string[]): string {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;

    let summary = `Code Review Summary: `;

    if (errors === 0 && warnings === 0 && suggestions.length === 0) {
      summary += '✅ No issues found! Code looks good.';
    } else {
      const parts = [];
      if (errors > 0) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
      if (warnings > 0) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
      if (suggestions.length > 0) parts.push(`${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''}`);

      summary += parts.join(', ');
    }

    return summary;
  }

  /**
   * Calculate overall score (0-100)
   */
  private _calculateScore(issues: ReviewComment[]): number {
    const errorPenalty = issues.filter(i => i.severity === 'error').length * 10;
    const warningPenalty = issues.filter(i => i.severity === 'warning').length * 3;
    const penalty = Math.min(errorPenalty + warningPenalty, 100);

    return Math.max(0, 100 - penalty);
  }

  /**
   * Check if file is a code file
   */
  private _isCodeFile(filename: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c'];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  /**
   * Check if file is a documentation file
   */
  private _isDocFile(filename: string): boolean {
    const docExtensions = ['.md', '.mdx', '.rst', '.txt'];
    return docExtensions.some(ext => filename.endsWith(ext)) || filename.includes('README');
  }

  /**
   * Get file type for context query
   */
  private _getFileType(filename: string): string {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'TypeScript/TSX';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'JavaScript/JSX';
    if (filename.endsWith('.py')) return 'Python';
    if (filename.endsWith('.md')) return 'Markdown documentation';
    return 'source';
  }

  /**
   * Filter out common false positives in code review
   */
  private _isFalsePositive(message: string): boolean {
    const falsePositivePatterns = [
      /hardcoded/i,
      /environment variables.*should not be/i,
      /api key.*hardcoded/i,
      /secrets.*hardcoded/i,
      /property.*is hardcoded/i,
      /not use descriptive name/i,
      /more descriptive name/i,
      /should be a number/i,
    ];

    return falsePositivePatterns.some(pattern => pattern.test(message));
  }
}
