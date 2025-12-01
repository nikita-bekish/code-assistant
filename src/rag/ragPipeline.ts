import { TextChunk, SearchResult, AnswerWithSources } from '../types/index.js';

/**
 * Simple cosine similarity based search
 * In production, this would use proper vector embeddings
 */
export class RAGPipeline {
  private chunks: TextChunk[] = [];
  private model: string = 'llama3.2';

  setChunks(chunks: TextChunk[]): void {
    this.chunks = chunks;
  }

  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Search for relevant chunks using simple keyword matching
   * In production, this would use semantic search with embeddings
   */
  search(query: string, maxResults: number = 5): SearchResult[] {
    const queryWords = this._tokenize(query);
    const scores: Array<{ chunk: TextChunk; score: number }> = [];

    for (const chunk of this.chunks) {
      const chunkWords = this._tokenize(chunk.content);
      let score = this._calculateSimilarity(queryWords, chunkWords);

      // If no match found, give a minimal score based on chunk quality
      // This enables cross-language search to still return results
      if (score === 0) {
        // Prefer chunks with more words (likely more informative)
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
    return text
      .toLowerCase()
      .match(/\b\w+\b/g) || [];
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
      // Exact match - high priority
      if (chunkFreq.has(qWord)) {
        score += 2.0; // Exact match worth 2 points
        matchedWords++;
      } else {
        // Partial match - lower priority
        for (const [cWord] of chunkFreq) {
          if (qWord.length > 2 && cWord.length > 2) {
            // Give higher score for longer shared substrings
            if (qWord.includes(cWord) || cWord.includes(qWord)) {
              const sharedLength = Math.min(qWord.length, cWord.length);
              score += Math.max(0.3, sharedLength / qWord.length); // At least 0.3, up to 1.0
              matchedWords++;
              break; // Only match once per query word
            }
          }
        }
      }
    }

    // Normalize: score based on percentage of matched query words
    // Plus a bonus for chunk quality (having many relevant words)
    const matchRatio = matchedWords / queryWords.length;
    const baseScore = Math.min(score / (2.0 * queryWords.length), 1.0);

    // If we have matches, return the base score
    // Otherwise return 0 (no fallback here, we'll handle in search())
    return matchRatio > 0 ? Math.max(baseScore, matchRatio * 0.5) : 0;
  }
}
