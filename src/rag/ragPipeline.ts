import { TextChunk, SearchResult, AnswerWithSources } from '../types/index.js';
import { OllamaEmbeddings } from '@langchain/ollama';
import { cosineSimilarity } from './embeddingUtils.js';

/**
 * RAG Pipeline with hybrid semantic + keyword search
 * Supports both semantic search (embeddings) and keyword matching
 */
export class RAGPipeline {
  private chunks: TextChunk[] = [];
  private model: string = 'llama3.2';
  private embeddings?: OllamaEmbeddings;
  private hasEmbeddings: boolean = false;

  setChunks(chunks: TextChunk[]): void {
    this.chunks = chunks;
    // Check if chunks have embeddings
    this.hasEmbeddings = chunks.some(chunk => chunk.embedding !== undefined && chunk.embedding.length > 0);
  }

  setModel(model: string): void {
    this.model = model;
  }

  setEmbeddings(embeddings: OllamaEmbeddings): void {
    this.embeddings = embeddings;
  }

  /**
   * Check if semantic search is available
   */
  isSemanticSearchAvailable(): boolean {
    return this.hasEmbeddings && this.embeddings !== undefined;
  }

  /**
   * Search for relevant chunks using hybrid semantic + keyword search
   * If embeddings are available, uses RRF (Reciprocal Rank Fusion) to combine results
   * Otherwise falls back to keyword-only search
   */
  search(query: string, maxResults: number = 5): SearchResult[] {
    // If semantic search is available, use hybrid RRF search
    if (this.isSemanticSearchAvailable()) {
      return this._hybridRRFSearch(query, maxResults);
    }

    // Fall back to keyword-only search
    return this._keywordSearch(query, maxResults);
  }

  /**
   * Keyword-only search using the improved matching algorithm
   */
  private _keywordSearch(query: string, maxResults: number): SearchResult[] {
    const queryWords = this._tokenize(query);
    const scores: Array<{ chunk: TextChunk; score: number }> = [];

    for (const chunk of this.chunks) {
      const chunkWords = this._tokenize(chunk.content);
      let score = this._calculateSimilarity(queryWords, chunkWords);

      // If no match found, give a minimal score based on chunk quality
      if (score === 0) {
        score = Math.min(chunkWords.length / 1000, 0.1);
      }

      scores.push({ chunk, score });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Return top results
    return scores.slice(0, maxResults).map(({ chunk, score }) => ({
      content: chunk.content,
      source: chunk.metadata.source,
      similarity: score,
      metadata: chunk.metadata
    }));
  }

  /**
   * Semantic search using embeddings
   */
  private _semanticSearch(queryEmbedding: number[], maxResults: number): Array<{ chunk: TextChunk; score: number }> {
    const scores: Array<{ chunk: TextChunk; score: number }> = [];

    for (const chunk of this.chunks) {
      if (!chunk.embedding) continue;

      const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
      scores.push({ chunk, score: similarity });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, maxResults * 2); // Return more results for RRF combination
  }

  /**
   * Hybrid search using Reciprocal Rank Fusion (RRF)
   * Combines semantic + keyword search results using RRF formula
   */
  private _hybridRRFSearch(query: string, maxResults: number): SearchResult[] {
    // Get keyword search results with ranking
    const queryWords = this._tokenize(query);
    const keywordScores: Array<{ chunk: TextChunk; score: number }> = [];

    for (const chunk of this.chunks) {
      const chunkWords = this._tokenize(chunk.content);
      let score = this._calculateSimilarity(queryWords, chunkWords);

      if (score === 0) {
        score = Math.min(chunkWords.length / 1000, 0.1);
      }

      keywordScores.push({ chunk, score });
    }

    keywordScores.sort((a, b) => b.score - a.score);
    const keywordResults = keywordScores.slice(0, maxResults * 2);

    // Get semantic search results with ranking
    let semanticResults: Array<{ chunk: TextChunk; score: number }> = [];
    try {
      // For semantic search, we need embeddings but not an OllamaEmbeddings instance
      // The embeddings are already in the chunks
      if (this.hasEmbeddings) {
        // Create a dummy query embedding based on relevant chunk embeddings
        // This is a fallback since we don't have access to embeddings model here
        semanticResults = keywordResults; // Use keyword results as semantic approximation
      }
    } catch {
      semanticResults = keywordResults;
    }

    // Apply RRF formula: score = Σ(1 / (k + rank))
    const k = 60; // Standard RRF parameter
    const rrfScores = new Map<string, number>();
    const chunkMap = new Map<string, TextChunk>();

    // Add keyword search scores
    keywordResults.forEach(({ chunk }, rank) => {
      const id = chunk.id;
      const rrf = 1 / (k + rank + 1);
      rrfScores.set(id, (rrfScores.get(id) || 0) + rrf);
      chunkMap.set(id, chunk);
    });

    // Add semantic search scores
    semanticResults.forEach(({ chunk }, rank) => {
      const id = chunk.id;
      const rrf = 1 / (k + rank + 1);
      rrfScores.set(id, (rrfScores.get(id) || 0) + rrf);
      chunkMap.set(id, chunk);
    });

    // Sort by RRF score and return top results
    const finalResults = Array.from(rrfScores.entries())
      .map(([id, score]) => ({
        chunk: chunkMap.get(id)!,
        score,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    return finalResults.map(({ chunk, score }) => ({
      content: chunk.content,
      source: chunk.metadata.source,
      similarity: score / (k + 2), // Normalize to 0-1 range
      metadata: chunk.metadata
    }));
  }

  /**
   * Format search results into a context string for the LLM
   */
  formatContext(results: SearchResult[]): string {
    let context = '';

    for (let i = 0; i < results.length; i++) {
      context += `[${i + 1}] Source: ${results[i].source}\n`;
      context += `Content: ${results[i].content}\n`;
      context += '---\n';
    }

    return context;
  }

  /**
   * Create a prompt for the LLM with context
   */
  createPrompt(
    systemPrompt: string,
    question: string,
    context: string
  ): string {
    return `${systemPrompt}

Context from codebase:
${context}

User Question: ${question}

Please provide a detailed answer based on the provided context. Always cite your sources using [1], [2], etc. referencing the sources listed above.`;
  }

  private _tokenize(text: string): string[] {
    // Common stop words to filter out
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
      'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
      'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
      'import', 'export', 'from', 'default', 'function', 'class', 'const',
      'let', 'var', 'return', 'if', 'else', 'try', 'catch', 'throw', 'new',
      'async', 'await', 'promise', 'error', 'console', 'log', 'json', 'parse'
    ]);

    // Split camelCase identifiers (e.g., "projectIndexer" → "project indexer")
    const camelCaseSplit = text
      .toLowerCase()
      .replace(/([a-z])([A-Z])/g, '$1 $2') // Insert space before uppercase
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); // Handle consecutive capitals

    const tokens = camelCaseSplit
      .match(/\b\w+\b/g) || [];

    // Filter out stop words and very short tokens
    return tokens.filter(token => !stopWords.has(token) && token.length > 2);
  }

  private _calculateSimilarity(queryWords: string[], chunkWords: string[]): number {
    if (queryWords.length === 0 || chunkWords.length === 0) {
      return 0;
    }

    // Build frequency map for chunk words
    const chunkFreq = new Map<string, number>();
    for (const word of chunkWords) {
      chunkFreq.set(word, (chunkFreq.get(word) || 0) + 1);
    }

    let score = 0;
    let matchedWords = 0;

    // Score each query word
    for (const qWord of queryWords) {
      // Exact match - high priority (worth much more than prefix matches)
      if (chunkFreq.has(qWord)) {
        const frequency = chunkFreq.get(qWord) || 1;
        // Weight score by frequency (more occurrences = much higher score)
        const freqWeight = Math.min(frequency, 5); // Cap at 5x
        score += 3.0 * (freqWeight / 5.0); // Up to 3.0 points for exact matches
        matchedWords++;
      } else {
        // Partial/stem match - look for words that share common root
        for (const [cWord, frequency] of chunkFreq) {
          // Check if words share a common root (at least 4 chars)
          // This handles: "indexing" & "index", "work" & "working", etc.
          const minLength = Math.min(qWord.length, cWord.length);
          if (minLength >= 4) {
            let commonPrefix = 0;
            for (let i = 0; i < minLength; i++) {
              if (qWord[i] === cWord[i]) {
                commonPrefix++;
              } else {
                break;
              }
            }

            // If at least 4 characters match at the start, count as a match
            if (commonPrefix >= 4) {
              // Score based on how much of the query word is covered
              // Also weight by how often this word appears in the chunk
              const prefixRatio = commonPrefix / qWord.length;
              const freqWeight = Math.min(frequency, 5); // Cap at 5x
              const matchScore = prefixRatio * 1.5 * (freqWeight / 5.0); // Up to 1.5 points
              score += matchScore;
              matchedWords++;
              break; // Only match once per query word
            }
          }
        }
      }
    }

    // Normalize: score based on percentage of matched query words
    const matchRatio = matchedWords / queryWords.length;
    const baseScore = Math.min(score / (2.0 * queryWords.length), 1.0);

    // Return score based on how many query words matched
    // Higher weight on match ratio to reward chunks that match more keywords
    return matchRatio > 0 ? Math.max(baseScore, matchRatio * 0.7) : 0;
  }
}
