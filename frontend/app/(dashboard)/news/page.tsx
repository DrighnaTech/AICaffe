'use client';

export default function NewsPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-medium mb-6">
        In Development
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">AI News Feed</h1>
      <p className="text-gray-400 max-w-md mb-2">
        Curated AI news aggregated from leading sources — OpenAI, Anthropic, Google AI, Meta AI,
        arXiv, TechCrunch, The Verge, and more.
      </p>
      <p className="text-gray-500 text-sm max-w-sm">
        Articles will be auto-summarized using the cheapest available model and refreshed every
        30 minutes via a background scheduler.
      </p>
    </div>
  );
}
