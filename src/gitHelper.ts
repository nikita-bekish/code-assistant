import { execSync } from 'child_process';
import { CommitInfo, ProjectStats } from './types/index.js';

export class GitHelper {
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
  }

  async getCurrentBranch(): Promise<string> {
    try {
      const result = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: this.repoPath,
        encoding: 'utf-8'
      });
      return result.trim();
    } catch (error) {
      return 'unknown';
    }
  }

  async getLastCommits(count: number): Promise<CommitInfo[]> {
    try {
      const format = '%H%n%an%n%ai%n%s%n---END---';
      const result = execSync(`git log -${count} --format="${format}"`, {
        cwd: this.repoPath,
        encoding: 'utf-8'
      });

      const commits: CommitInfo[] = [];
      const commitStrings = result.split('---END---').filter(s => s.trim());

      for (const commitStr of commitStrings) {
        const lines = commitStr.trim().split('\n');
        if (lines.length >= 4) {
          commits.push({
            hash: lines[0],
            author: lines[1],
            date: lines[2],
            message: lines[3],
            files: []
          });
        }
      }

      return commits;
    } catch (error) {
      return [];
    }
  }

  async getFileHistory(filepath: string): Promise<CommitInfo[]> {
    try {
      const format = '%H%n%an%n%ai%n%s%n---END---';
      const result = execSync(`git log --format="${format}" -- "${filepath}"`, {
        cwd: this.repoPath,
        encoding: 'utf-8'
      });

      const commits: CommitInfo[] = [];
      const commitStrings = result.split('---END---').filter(s => s.trim());

      for (const commitStr of commitStrings) {
        const lines = commitStr.trim().split('\n');
        if (lines.length >= 4) {
          commits.push({
            hash: lines[0],
            author: lines[1],
            date: lines[2],
            message: lines[3],
            files: [filepath]
          });
        }
      }

      return commits;
    } catch (error) {
      return [];
    }
  }

  async getProjectStats(): Promise<ProjectStats> {
    try {
      const branch = await this.getCurrentBranch();
      const latestCommits = await this.getLastCommits(5);

      // Count total commits
      const totalCommitsResult = execSync('git rev-list --count HEAD', {
        cwd: this.repoPath,
        encoding: 'utf-8'
      });
      const totalCommits = parseInt(totalCommitsResult.trim(), 10);

      // Count files
      const fileCountResult = execSync('git ls-files | wc -l', {
        cwd: this.repoPath,
        encoding: 'utf-8'
      });
      const fileCount = parseInt(fileCountResult.trim(), 10);

      // Count lines of code
      let totalLOC = 0;
      try {
        const locResult = execSync('git ls-files | xargs wc -l | tail -1', {
          cwd: this.repoPath,
          encoding: 'utf-8'
        });
        const match = locResult.trim().match(/^(\d+)/);
        totalLOC = match ? parseInt(match[1], 10) : 0;
      } catch {
        totalLOC = 0;
      }

      return {
        branch,
        totalCommits,
        latestCommits,
        totalLOC,
        fileCount
      };
    } catch (error) {
      return {
        branch: 'unknown',
        totalCommits: 0,
        latestCommits: [],
        totalLOC: 0,
        fileCount: 0
      };
    }
  }

  async getStatus(): Promise<string> {
    try {
      const result = execSync('git status --short', {
        cwd: this.repoPath,
        encoding: 'utf-8'
      });
      return result;
    } catch (error) {
      return '';
    }
  }
}
