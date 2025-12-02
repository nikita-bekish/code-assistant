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

    const reviewPrompt = `
You are a code reviewer. Analyze this code change and identify issues:

File: ${file.filename}
Changes: +${file.additions} -${file.deletions}

Diff:
\`\`\`
${file.patch}
\`\`\`

Identify any:
1. Security vulnerabilities
2. Logic errors or bugs
3. Performance issues
4. Code style violations
5. Type safety issues
6. Missing error handling

Format response as JSON array of issues with this structure:
[
  {
    "line": <line number where issue occurs>,
    "severity": "error|warning|info",
    "message": "<clear description of the issue>"
  }
]

If no issues found, return empty array: []
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

        return issuesData.map(issue => ({
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
Review these documentation file changes and suggest improvements:

Files changed: ${files.map(f => f.filename).join(', ')}

Consider:
1. Are changes well-documented?
2. Are examples clear and correct?
3. Is the documentation structure logical?
4. Are there any missing explanations?

Provide 2-3 brief suggestions to improve the documentation.
Format as a simple text list.
`;

    try {
      const result = await this.assistant.ask(docPrompt);
      // Extract suggestions from response
      const lines = result.answer.split('\n').filter((line: string) => line.trim().length > 0);
      suggestions.push(...lines.slice(0, 3));
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
}
