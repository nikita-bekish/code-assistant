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
      const score = this._calculateSimilarity(queryWords, chunkWords);

      if (score > 0) {
        scores.push({ chunk, score });
      }
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

    const querySet = new Set(queryWords);
    const chunkSet = new Set(chunkWords);

    // Calculate Jaccard similarity
    let intersection = 0;
    for (const word of querySet) {
      if (chunkSet.has(word)) {
        intersection++;
      }
    }

    const union = querySet.size + chunkSet.size - intersection;
    return intersection / union;
  }
}
