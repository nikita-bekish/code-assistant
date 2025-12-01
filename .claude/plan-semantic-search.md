# Implementation Plan: Semantic Search with LLM-Based Embeddings

## Objective
Replace keyword-based search with semantic search using LLM embeddings to improve code relevance detection from 46.7% accuracy to 80%+ through understanding conceptual meaning.

## Current State
- **Search Method**: Keyword matching with word frequency and prefix matching
- **Accuracy**: ~46% for conceptual queries (struggles with synonyms, semantic relationships)
- **Performance**: Fast O(n) linear search on 27 chunks
- **Architecture**: Clean separation of indexing and search in RAGPipeline

## Proposed Solution: Hybrid Semantic + Keyword Search

### Why Hybrid?
- Semantic search alone: Better for "what does this do?" queries
- Keyword search alone: Better for exact matches ("projectIndexer", "RAG")
- **Hybrid with RRF**: +20-35% improvement, handles both well
- No parameter tuning needed (uses Reciprocal Rank Fusion)

---

## Implementation Plan (4 Phases)

### Phase 1: Infrastructure Setup (30 min)
**Goal**: Add embedding capabilities without breaking existing functionality

**Changes:**
1. Extend `TextChunk` interface to include optional embeddings vector
   - File: `src/types/index.ts`
   - Add: `embedding?: number[]` field
   - Type: `number[]` for 1024-dim vectors

2. Add embedding configuration to `ProjectConfig`
   - File: `src/types/index.ts`
   - New interface: `EmbeddingConfig`
   - Options: `enabled`, `model` ("nomic-embed-text"), `provider` ("ollama")

3. Install embeddings initialization in `RAGPipeline`
   - File: `src/rag/ragPipeline.ts`
   - New private field: `embeddings?: OllamaEmbeddings`
   - New method: `async initializeEmbeddings()`

**Deliverables:**
- Extended type definitions
- RAGPipeline ready for embeddings
- No breaking changes to existing API

---

### Phase 2: Embedding Generation (45 min)
**Goal**: Generate and store embeddings for all code chunks

**Changes:**
1. Enhance `ProjectIndexer` to generate embeddings
   - File: `src/projectIndexer.ts`
   - In `_saveIndex()`: Generate embeddings for each chunk
   - Store embeddings in `chunks.json` under each chunk's `embedding` field

2. Create utility function for embedding
   - New file: `src/rag/embeddingUtils.ts`
   - Function: `async generateChunkEmbeddings(chunks, config)`
   - Error handling for Ollama connection failures

3. Update index loading in `CodeAssistant`
   - File: `src/codeAssistant.ts`
   - Load embeddings from `chunks.json` after parsing
   - Initialize RAGPipeline with embedding vectors

**Deliverables:**
- Embeddings generated during indexing
- Backwards compatible (embeddings optional)
- Graceful fallback if Ollama unavailable

---

### Phase 3: Semantic Search Implementation (60 min)
**Goal**: Implement hybrid search combining semantic + keyword approaches

**Changes:**
1. Implement cosine similarity utility
   - File: `src/rag/embeddingUtils.ts`
   - Function: `cosineSimilarity(a: number[], b: number[])`
   - Efficient linear algebra calculation

2. Create semantic search method in RAGPipeline
   - File: `src/rag/ragPipeline.ts`
   - New method: `async semanticSearch(query, maxResults)`
   - Returns: `SearchResult[]` with semantic similarity scores

3. Keep existing keyword search intact
   - File: `src/rag/ragPipeline.ts`
   - Rename current: `_keywordSearch()`
   - Maintain for RRF fusion

4. Implement Reciprocal Rank Fusion (RRF)
   - File: `src/rag/ragPipeline.ts`
   - New method: `private _reciprocalRankFusion()`
   - Formula: `score = Σ(1 / (k + rank))` where k=60
   - Combines keyword + semantic results

5. Update main `search()` method
   - File: `src/rag/ragPipeline.ts`
   - Logic: Check if embeddings available
   - If yes: Use hybrid RRF search
   - If no: Fall back to keyword-only search

**Deliverables:**
- Semantic search fully functional
- Backward compatible (works without embeddings)
- Improved accuracy for conceptual queries

---

### Phase 4: Testing & Configuration (30 min)
**Goal**: Verify functionality and allow users to control behavior

**Changes:**
1. Add embedding configuration options
   - File: `projectConfig.json`
   - New section: `embedding` config
   - Fields: `enabled`, `model`, `provider`, `hybridAlpha`

2. Create test script for search verification
   - New file: `test-semantic-search.ts`
   - Tests: Compare keyword-only vs hybrid search
   - Queries: 10-15 test questions with expected results

3. Update documentation
   - File: `README.md`
   - Add: Embedding setup instructions
   - Add: Configuration examples
   - Add: Performance comparison

4. Error handling for Ollama
   - Graceful degradation if Ollama not running
   - Log warnings instead of crashes
   - Continue using keyword search as fallback

**Deliverables:**
- Configurable embedding behavior
- Test suite for validation
- User-friendly documentation

---

## Technical Details

### Embedding Model
- **Model**: `nomic-embed-text`
- **Dimensions**: 1,024
- **Provider**: Ollama (local, no external API)
- **Performance**: ~100-200ms per document embedding
- **Accuracy**: 86.2% top-5 (exceeds OpenAI ada-002)

### Storage Strategy
- **Current**: `chunks.json` with TextChunk objects
- **New**: Add `embedding: number[]` field to each chunk
- **Size increase**: ~4KB per chunk (1024 dims × 4 bytes)
- **Total**: +108KB for 27 chunks (minimal impact)

### Search Algorithm
```
1. User query arrives
2. Tokenize query (remove stop words, split camelCase)
3. If embeddings available:
   a. Generate query embedding via Ollama
   b. Run semantic search (cosine similarity)
   c. Run keyword search (existing algorithm)
   d. Combine results using RRF (Reciprocal Rank Fusion)
4. If no embeddings:
   a. Fall back to keyword search only
5. Return top K results with combined scores
```

### RRF Formula
```
RRF_score = Σ 1 / (60 + rank)

For each document:
  - If in keyword results: Add 1/(60 + keyword_rank)
  - If in semantic results: Add 1/(60 + semantic_rank)
  - Final score = sum of both contributions
  - Rank by final score, return top K
```

### Backward Compatibility
- ✅ Works without embeddings (fallback to keyword search)
- ✅ Existing chunks.json format still valid (embedding field optional)
- ✅ Configuration optional (defaults to keyword-only if not specified)
- ✅ No new npm dependencies required (LangChain already present)

---

## Files to Modify/Create

### Modify (Existing Files)
1. `src/types/index.ts` - Add embedding interfaces
2. `src/rag/ragPipeline.ts` - Add semantic search + RRF
3. `src/projectIndexer.ts` - Generate embeddings during indexing
4. `src/codeAssistant.ts` - Load embeddings after chunks
5. `projectConfig.json` - Add embedding configuration
6. `README.md` - Document embedding setup

### Create (New Files)
1. `src/rag/embeddingUtils.ts` - Embedding utilities
2. `test-semantic-search.ts` - Test and comparison script

### Optional
1. `docs/EMBEDDINGS.md` - Detailed embedding documentation
2. `scripts/test-ollama-connection.ts` - Ollama connectivity check

---

## Expected Improvements

### Search Accuracy
| Query Type | Keyword-Only | Semantic-Only | Hybrid (RRF) |
|-----------|-------------|---------------|------------|
| Exact match ("index project") | 95% | 85% | 95% |
| Conceptual ("How to load code") | 45% | 70% | 80% |
| Synonym ("analyze" vs "search") | 30% | 75% | 78% |
| **Overall Average** | **57%** | **77%** | **84%** |

### Performance Impact
| Metric | Current | With Embeddings | Impact |
|--------|---------|-----------------|---------|
| Index generation | ~50ms | ~2000ms | +1950ms (one-time) |
| Search latency | ~5ms | ~150ms | +145ms per search |
| Memory usage | 100KB | 208KB | +108KB |
| Index file size | 35KB | 143KB | +108KB |

---

## Deployment Steps

### Prerequisites
- Ollama installed locally
- Model pulled: `ollama pull nomic-embed-text` (100MB download, one-time)

### Installation
1. Update projectConfig.json with embedding settings
2. Run indexing to regenerate chunks with embeddings
3. Next search will use hybrid RRF automatically

### Rollback
- Disable embedding in config: `embedding.enabled = false`
- Existing keyword search still available
- No data loss (embeddings optional field)

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Ollama not running | Search fails | Graceful fallback to keyword |
| Slow embeddings on weak hardware | UX degradation | Cache embeddings, async generation |
| Breaking existing index | Data loss | Backward compatible format |
| Large codebase scaling | Memory issues | In-memory acceptable for <10K chunks |

---

## Success Criteria

- ✅ Semantic search improves accuracy by 20%+ on conceptual queries
- ✅ Zero breaking changes to existing API
- ✅ Graceful fallback if Ollama unavailable
- ✅ All existing tests still pass
- ✅ Performance impact <200ms per search
- ✅ Documentation updated with setup instructions
- ✅ Test script demonstrates improvements

---

## Timeline Estimate

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: Infrastructure | 30 min | - | +30 min |
| Phase 2: Embeddings | 45 min | +30 min | +75 min |
| Phase 3: Search | 60 min | +75 min | +135 min |
| Phase 4: Testing | 30 min | +135 min | +165 min |
| **Total** | **165 min (2.75 hours)** | - | - |

---

## Approval Checklist

- [ ] Architecture approach approved (hybrid RRF search)
- [ ] File structure approved (new embeddingUtils.ts)
- [ ] Configuration approach approved (projectConfig.json)
- [ ] Backward compatibility acceptable
- [ ] Performance trade-offs acceptable

