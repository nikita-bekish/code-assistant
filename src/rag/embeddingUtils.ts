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
    // Process embeddings one by one to handle the Ollama API format
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];

      // Add progress logging every 50 chunks
      if (i % 50 === 0) {
        console.log(`  Processing embedding ${i + 1}/${texts.length}...`);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout per chunk

      try {
        const response = await fetch(`${baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            prompt: text,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as { embedding: number[] };
        embeddings.push(data.embedding);

        // Small delay between requests to avoid overwhelming Ollama
        await new Promise(resolve => setTimeout(resolve, 10));
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    }

    return embeddings;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate embeddings: ${errorMessage}`);
  }
}

/**
 * Generate simple keyword-based embeddings as fallback
 * Creates a sparse vector based on word frequencies
 */
function generateFallbackEmbeddings(chunks: TextChunk[]): number[][] {
  // Build vocabulary from all chunks
  const vocabulary = new Set<string>();
  const tokenizedChunks: string[][] = [];

  for (const chunk of chunks) {
    const tokens = chunk.content
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2); // Filter short words

    tokenizedChunks.push(tokens);
    tokens.forEach(t => vocabulary.add(t));
  }

  const vocabArray = Array.from(vocabulary);
  const vocabIndex = new Map(vocabArray.map((word, idx) => [word, idx]));

  // Create sparse vectors using TF-IDF concept
  const embeddings: number[][] = [];
  for (const tokens of tokenizedChunks) {
    const vector = new Array(Math.min(vocabArray.length, 256)).fill(0);
    const termFreq = new Map<string, number>();

    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    for (const [token, freq] of termFreq) {
      const idx = vocabIndex.get(token);
      if (idx !== undefined && idx < 256) {
        vector[idx] = freq / tokens.length; // Normalize by chunk size
      }
    }

    embeddings.push(vector);
  }

  return embeddings;
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

    console.log(`Successfully generated ${embeddingVectors.length} embeddings using Ollama`);

    return chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddingVectors[idx],
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`⚠️  Failed to generate Ollama embeddings: ${errorMessage}`);
    console.warn('⚠️  Using fallback keyword-based embeddings instead');

    // Use fallback embeddings
    const fallbackEmbeddings = generateFallbackEmbeddings(chunks);
    console.log(`✓ Generated ${fallbackEmbeddings.length} fallback embeddings`);

    return chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: fallbackEmbeddings[idx],
    }));
  }
}

/**
 * Embed a single query string using Ollama or fallback
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
    // Use fallback for query embedding
    const tokens = query
      .toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2);

    // Create simple vector with presence flags
    const vector = new Array(256).fill(0);
    for (let i = 0; i < tokens.length && i < 256; i++) {
      vector[i] = 1;
    }

    return vector;
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
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'test',
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
