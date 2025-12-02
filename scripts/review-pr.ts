/**
 * GitHub PR Code Review Script
 * Runs in GitHub Actions to review pull requests
 *
 * Environment variables:
 * - GITHUB_TOKEN: GitHub API token
 * - OPENAI_API_KEY: OpenAI API key for code analysis
 * - GITHUB_EVENT_PATH: Path to GitHub event payload
 */

import fs from 'fs/promises';
import path from 'path';
import { Octokit } from '@octokit/rest';
import { PRReviewer, FileChange } from '../src/prReviewer.js';
import { ProjectConfig } from '../src/types/index.js';

interface GitHubContext {
  payload: {
    pull_request: {
      number: number;
      head: {
        sha: string;
        repo: {
          name: string;
          owner: {
            login: string;
          };
        };
      };
      base: {
        sha: string;
      };
    };
  };
  repo: {
    owner: string;
    repo: string;
  };
}

/**
 * Main review function
 */
async function reviewPullRequest() {
  // Get GitHub context
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH not set - must run in GitHub Actions');
  }

  const eventData = JSON.parse(await fs.readFile(eventPath, 'utf-8')) as GitHubContext['payload'];
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error('GITHUB_TOKEN not set');
  }

  const prNumber = eventData.pull_request.number;
  const owner = eventData.pull_request.head.repo.owner.login;
  const repo = eventData.pull_request.head.repo.name;

  console.log(`📝 Reviewing PR #${prNumber} in ${owner}/${repo}`);

  // Initialize GitHub API client
  const octokit = new Octokit({ auth: token });

  try {
    // Get list of changed files
    console.log('📄 Fetching changed files...');
    const filesResponse = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    });

    const files = filesResponse.data.map(file => ({
      filename: file.filename,
      patch: file.patch,
      changes: file.changes,
      additions: file.additions,
      deletions: file.deletions,
      status: file.status as 'added' | 'modified' | 'deleted' | 'renamed' | 'copied',
    })) as FileChange[];

    console.log(`Found ${files.length} changed files`);

    // Create PR reviewer
    const config: ProjectConfig = {
      projectName: repo,
      projectDescription: `Repository: ${repo}`,
      paths: {
        root: process.cwd(),
        git: process.cwd(),
        output: 'node_modules/.code-assistant',
      },
      indexing: {
        includeFolders: ['src', 'lib', 'docs'],
        excludeFolders: ['node_modules', '.git', 'build', 'dist', '.next', 'venv', '.claude'],
        includeFileTypes: ['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.py'],
        excludePatterns: ['*.test.*', '*.spec.*', '*.min.js'],
        maxFileSize: '1MB',
        chunkSize: 400,
        chunkOverlap: 100,
      },
      git: {
        enabled: true,
        includeCommitHistory: true,
        maxCommitsToFetch: 50,
      },
      llm: {
        model: 'gpt-3.5-turbo',
        temperature: 0.2,
        topP: 0.8,
        contextWindow: 20,
        maxResults: 5,
      },
      prompt: {
        system: 'You are an experienced code reviewer. Analyze code thoroughly and provide actionable feedback.',
        language: 'en',
      },
      embedding: {
        enabled: true,
        model: 'nomic-embed-text',
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
      },
    };

    const reviewer = new PRReviewer(config);
    console.log('🚀 Initializing reviewer...');
    await reviewer.initialize();

    // Review changes
    console.log('🔍 Analyzing code changes...');
    const review = await reviewer.reviewChanges(files);

    console.log(`✅ Review complete: ${review.overallScore}/100`);
    console.log(`Issues found: ${review.issues.length}`);
    console.log(`Suggestions: ${review.suggestions.length}`);

    // Post review as PR comment
    console.log('📤 Posting review to GitHub...');
    const comment = formatReviewComment(review);
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: comment,
    });

    console.log('✨ Review posted successfully!');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ Review failed:', errorMsg);

    // Post error comment
    const errorComment = `## 🚨 Code Review Failed\n\nAn error occurred during code review:\n\`\`\`\n${errorMsg}\n\`\`\``;
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: errorComment,
    });

    process.exit(1);
  }
}

/**
 * Format review as GitHub markdown comment
 */
function formatReviewComment(review: Awaited<ReturnType<PRReviewer['reviewChanges']>>): string {
  let comment = '';

  // Header with score
  const scoreEmoji = review.overallScore >= 80 ? '✅' : review.overallScore >= 60 ? '⚠️' : '❌';
  comment += `## ${scoreEmoji} Code Review\n\n`;
  comment += `**Score: ${review.overallScore}/100**\n\n`;

  // Summary
  comment += `### Summary\n${review.summary}\n\n`;

  // Issues
  if (review.issues.length > 0) {
    comment += `### 🐛 Issues Found (${review.issues.length})\n\n`;

    const errors = review.issues.filter(i => i.severity === 'error');
    const warnings = review.issues.filter(i => i.severity === 'warning');
    const infos = review.issues.filter(i => i.severity === 'info');

    if (errors.length > 0) {
      comment += `#### ❌ Errors\n`;
      errors.forEach(issue => {
        comment += `- **${issue.filename}:${issue.line}** - ${issue.message}\n`;
      });
      comment += '\n';
    }

    if (warnings.length > 0) {
      comment += `#### ⚠️ Warnings\n`;
      warnings.forEach(issue => {
        comment += `- **${issue.filename}:${issue.line}** - ${issue.message}\n`;
      });
      comment += '\n';
    }

    if (infos.length > 0) {
      comment += `#### ℹ️ Info\n`;
      infos.forEach(issue => {
        comment += `- **${issue.filename}:${issue.line}** - ${issue.message}\n`;
      });
      comment += '\n';
    }
  }

  // Suggestions
  if (review.suggestions.length > 0) {
    comment += `### 💡 Suggestions\n`;
    review.suggestions.forEach(suggestion => {
      comment += `- ${suggestion}\n`;
    });
    comment += '\n';
  }

  // Footer
  comment += `---\n*This review was generated by [Code Assistant](https://github.com/nikitabekish/my-code-assistant)*`;

  return comment;
}

// Run review
reviewPullRequest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
