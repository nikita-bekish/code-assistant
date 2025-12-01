import fs from 'fs/promises';
import path from 'path';
import { ProjectConfig, IndexedFile, TextChunk, IndexStats } from './types/index.js';
import { generateChunkEmbeddings } from './rag/embeddingUtils.js';

export class ProjectIndexer {
  private config: ProjectConfig;
  private chunks: TextChunk[] = [];
  private files: IndexedFile[] = [];
  private indexStats: IndexStats | null = null;

  constructor(config: ProjectConfig) {
    this.config = config;
  }

  async indexProject(): Promise<void> {
    const startTime = Date.now();
    const rootPath = this.config.paths.root;

    this.files = [];
    this.chunks = [];

    // Index each included folder
    for (const folder of this.config.indexing.includeFolders) {
      const folderPath = path.join(rootPath, folder);
      try {
        await this._indexFolder(folderPath, folder);
      } catch (error) {
        console.warn(`Warning: Could not index folder ${folder}:`, error);
      }
    }

    // Check if any files were indexed
    if (this.files.length === 0) {
      throw new Error(
        `No files were indexed. Check includeFolders: ${this.config.indexing.includeFolders.join(', ')} ` +
        `and includeFileTypes: ${this.config.indexing.includeFileTypes.join(', ')}`
      );
    }

    // Create chunks from indexed files
    this._createChunks();

    // Calculate stats
    this.indexStats = {
      totalFiles: this.files.length,
      totalChunks: this.chunks.length,
      totalSize: this.files.reduce((sum, f) => sum + f.metadata.size, 0),
      indexedAt: startTime,
      fileTypes: this._getFileTypeCounts()
    };

    // Save index
    await this._saveIndex();
  }

  async reindex(): Promise<void> {
    await this.indexProject();
  }

  getIndexStats(): IndexStats {
    if (!this.indexStats) {
      throw new Error('Index not yet created. Call indexProject() first.');
    }
    return this.indexStats;
  }

  getChunks(): TextChunk[] {
    return this.chunks;
  }

  async loadStatsFromFile(statsPath: string): Promise<void> {
    try {
      const statsData = await fs.readFile(statsPath, 'utf-8');
      this.indexStats = JSON.parse(statsData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load index stats from ${statsPath}: ${errorMessage}`);
    }
  }

  private async _indexFolder(folderPath: string, relativeFolder: string): Promise<void> {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);
        const relativePath = path.join(relativeFolder, entry.name);

        // Check if should exclude
        if (this._shouldExclude(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this._indexFolder(fullPath, relativePath);
        } else if (entry.isFile()) {
          await this._indexFile(fullPath, relativePath);
        }
      }
    } catch (error) {
      console.warn(`Could not read folder ${folderPath}:`, error);
    }
  }

  private async _indexFile(filePath: string, relativePath: string): Promise<void> {
    try {
      // Check file extension
      const ext = path.extname(filePath);
      if (!this.config.indexing.includeFileTypes.includes(ext)) {
        return;
      }

      // Check file size
      const stats = await fs.stat(filePath);
      const maxSizeBytes = this._parseSize(this.config.indexing.maxFileSize);
      if (stats.size > maxSizeBytes) {
        console.warn(`Skipping ${relativePath} (exceeds max size)`);
        return;
      }

      // Read file
      const content = await fs.readFile(filePath, 'utf-8');

      // Store indexed file
      this.files.push({
        path: relativePath,
        content,
        metadata: {
          type: ext,
          size: stats.size,
          lastModified: stats.mtimeMs
        }
      });
    } catch (error) {
      console.warn(`Could not index file ${filePath}:`, error);
    }
  }

  private _createChunks(): void {
    const chunkSize = this.config.indexing.chunkSize;
    const chunkOverlap = this.config.indexing.chunkOverlap;
    let globalChunkId = 0;

    for (const file of this.files) {
      const words = file.content.split(/\s+/);
      const chunks = [];

      for (let i = 0; i < words.length; i += chunkSize - chunkOverlap) {
        const chunkWords = words.slice(i, i + chunkSize);
        if (chunkWords.length === 0) continue;

        const content = chunkWords.join(' ');
        chunks.push({
          id: `chunk_${globalChunkId++}`,
          content,
          metadata: {
            source: file.path,
            chunkIndex: chunks.length,
            totalChunks: 0 // Will be updated
          }
        });
      }

      // Update total chunks count
      chunks.forEach(chunk => {
        chunk.metadata.totalChunks = chunks.length;
      });

      this.chunks.push(...chunks);
    }
  }

  private _shouldExclude(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');

    // Check exclude folders
    for (const excludeFolder of this.config.indexing.excludeFolders) {
      if (normalized.includes(`/${excludeFolder}/`) || normalized.startsWith(`${excludeFolder}/`)) {
        return true;
      }
    }

    // Check exclude patterns
    for (const pattern of this.config.indexing.excludePatterns) {
      const regex = this._globToRegex(pattern);
      if (regex.test(normalized)) {
        return true;
      }
    }

    return false;
  }

  private _globToRegex(glob: string): RegExp {
    const escaped = glob
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$|/${escaped}$`);
  }

  private _parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024
    };

    const match = sizeStr.match(/^(\d+)([A-Z]+)$/);
    if (!match) return 1024 * 1024; // Default 1MB

    const [, value, unit] = match as RegExpMatchArray;
    return parseInt(value, 10) * (units[unit as keyof typeof units] || 1);
  }

  private _getFileTypeCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const file of this.files) {
      counts[file.metadata.type] = (counts[file.metadata.type] || 0) + 1;
    }
    return counts;
  }

  private async _saveIndex(): Promise<void> {
    const outputDir = path.join(this.config.paths.root, this.config.paths.output);

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Generate embeddings if enabled
      let chunksToSave = this.chunks;
      if (this.config.embedding?.enabled) {
        console.log('Generating embeddings for chunks...');
        chunksToSave = await generateChunkEmbeddings(this.chunks, this.config);
      }

      // Save chunks
      const chunksPath = path.join(outputDir, 'chunks.json');
      await fs.writeFile(chunksPath, JSON.stringify(chunksToSave, null, 2));

      // Save stats
      const statsPath = path.join(outputDir, 'stats.json');
      await fs.writeFile(statsPath, JSON.stringify(this.indexStats, null, 2));

      console.log(`Index saved to ${outputDir}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save index to ${outputDir}: ${errorMessage}`);
    }
  }
}
