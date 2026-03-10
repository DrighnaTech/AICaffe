'use client';

export default function StoragePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-500/10 border border-gray-500/20 text-gray-400 text-xs font-medium mb-6">
        Coming Soon — Q3 2026
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">AiCaffe Drive</h1>
      <p className="text-gray-400 max-w-md mb-2">
        Persistent cloud storage for all your AI interactions — conversations, generated files,
        project spaces, and uploaded documents with full-text and semantic search.
      </p>
      <p className="text-gray-500 text-sm max-w-sm">
        Built on S3-compatible object storage with PostgreSQL GIN full-text search and
        pgvector embedding similarity for context retrieval across sessions.
      </p>
    </div>
  );
}
