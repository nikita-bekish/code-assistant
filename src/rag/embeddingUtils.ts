import { OllamaEmbeddings } from '@langchain/ollama';
import { TextChunk, ProjectConfig } from '../types/index.js';

/**
 * Compute cosine similarity between two vectors
 * Returns a value between 0 (dissimilar) and 1 (identical)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (normA * normB);
}

/**
 * Initialize Ollama embeddings with configuration
 */
export function initializeEmbeddings(config: ProjectConfig): OllamaEmbeddings | null {
  if (!config.embedding?.enabled) {
    return null;
  }

  return new OllamaEmbeddings({
    model: config.embedding.model,
    baseUrl: config.embedding.baseUrl || 'http://localhost:11434',
    requestOptions: {
      useMmap: true,
      numThread: 6,
    },
  });
}

/**
 * Generate embeddings for a batch of texts using Ollama HTTP API
 */
async function generateEmbeddingsBatch(
  texts: string[],
  baseUrl: string,
  model: string
): Promise<number[][]> {
  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { embeddings: number[][] };
    return data.embeddings;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate embeddings: ${errorMessage}`);
  }
}

/**
 * Generate embeddings for an array of text chunks
 * Returns the chunks with embeddings added
 */
export async function generateChunkEmbeddings(
  chunks: TextChunk[],
  config: ProjectConfig
): Promise<TextChunk[]> {
  if (!config.embedding?.enabled) {
    console.log('Embeddings disabled in configuration');
    return chunks;
  }

  try {
    console.log(`Generating embeddings for ${chunks.length} chunks using ${config.embedding.model}...`);
    const baseUrl = config.embedding.baseUrl || 'http://localhost:11434';
    const contents = chunks.map(chunk => chunk.content);

    // Generate embeddings via Ollama API
    const embeddingVectors = await generateEmbeddingsBatch(
      contents,
      baseUrl,
      config.embedding.model
    );

    console.log(`Successfully generated ${embeddingVectors.length} embeddings`);

    return chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddingVectors[idx],
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`Warning: Failed to generate embeddings: ${errorMessage}`);
    console.warn('Continuing without embeddings - keyword search will be used');
    console.warn(`Tip: Make sure Ollama is running: ollama serve`);
    console.warn(`Tip: Pull the embedding model: ollama pull ${config.embedding?.model || 'nomic-embed-text'}`);
    return chunks;
  }
}

/**
 * Embed a single query string using Ollama
 */
export async function embedQuery(
  query: string,
  config: ProjectConfig
): Promise<number[]> {
  if (!config.embedding?.enabled) {
    throw new Error('Embeddings not enabled in configuration');
  }

  try {
    const baseUrl = config.embedding.baseUrl || 'http://localhost:11434';
    const embeddings = await generateEmbeddingsBatch(
      [query],
      baseUrl,
      config.embedding.model
    );
    return embeddings[0];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to embed query: ${errorMessage}`);
  }
}

/**
 * Check if Ollama is available by attempting a simple embedding
 */
export async function isOllamaAvailable(
  baseUrl: string = 'http://localhost:11434',
  model: string = 'nomic-embed-text'
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: ['test'],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
