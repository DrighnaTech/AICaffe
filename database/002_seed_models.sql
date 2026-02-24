-- ============================================================================
-- AICaffe Platform - AI Models Seed Data
-- Version: 1.0.0
-- Description: Comprehensive AI model catalog with 50+ models from 22 providers
-- ============================================================================

-- ============================================================================
-- OPENAI MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- GPT-4o
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'GPT-4o', 'gpt-4o', '2024-08-06', 'gpt-4o',
 'Most advanced multimodal model. Great for complex tasks requiring vision and text understanding.',
 'Most advanced multimodal model with vision',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true, "json_mode": true}',
 128000, 16384, '2024-04-01', '200B+',
 2.50, 10.00, TRUE, TRUE, FALSE, 4.8,
 '{"mmlu": 88.7, "humaneval": 90.2, "gsm8k": 95.8}',
 450, 85),

-- GPT-4o-mini
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'GPT-4o Mini', 'gpt-4o-mini', '2024-07-18', 'gpt-4o-mini',
 'Fast and affordable model for lightweight tasks. Best balance of speed and intelligence.',
 'Fast, affordable GPT-4 class model',
 'llm',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true, "json_mode": true}',
 128000, 16384, '2024-04-01', '8B',
 0.15, 0.60, TRUE, TRUE, FALSE, 4.6,
 '{"mmlu": 82.0, "humaneval": 87.0, "gsm8k": 93.2}',
 180, 150),

-- GPT-4 Turbo
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'GPT-4 Turbo', 'gpt-4-turbo', '2024-04-09', 'gpt-4-turbo',
 'High-intelligence model for complex multi-step tasks with vision capabilities.',
 'High-intelligence model with vision',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true, "json_mode": true}',
 128000, 4096, '2023-12-01', '175B',
 10.00, 30.00, TRUE, FALSE, FALSE, 4.7,
 '{"mmlu": 86.4, "humaneval": 88.4, "gsm8k": 92.0}',
 600, 60),

-- o1-preview
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'o1-preview', 'o1-preview', '2024-09-12', 'o1-preview',
 'Reasoning model designed for complex problem-solving with chain-of-thought.',
 'Advanced reasoning model',
 'llm',
 '{"text": true, "reasoning": true, "streaming": true}',
 128000, 32768, '2024-04-01', '200B+',
 15.00, 60.00, TRUE, TRUE, FALSE, 4.9,
 '{"mmlu": 92.3, "gpqa": 78.3, "math": 94.8}',
 2000, 40),

-- o1-mini
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'o1-mini', 'o1-mini', '2024-09-12', 'o1-mini',
 'Fast reasoning model optimized for coding, math, and science tasks.',
 'Fast reasoning for STEM tasks',
 'llm',
 '{"text": true, "reasoning": true, "streaming": true}',
 128000, 65536, '2024-04-01', '100B',
 3.00, 12.00, TRUE, TRUE, FALSE, 4.7,
 '{"humaneval": 92.4, "math": 90.0, "gpqa": 60.0}',
 800, 80),

-- DALL-E 3
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'DALL-E 3', 'dall-e-3', '3.0', 'dall-e-3',
 'State-of-the-art image generation with exceptional prompt following.',
 'Advanced image generation',
 'image_generation',
 '{"text_to_image": true, "hd_quality": true, "natural_style": true, "vivid_style": true}',
 4000, NULL, '2023-10-01', NULL,
 NULL, NULL, TRUE, TRUE, FALSE, 4.7,
 '{}',
 15000, NULL),

-- Whisper
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'Whisper', 'whisper', '1.0', 'whisper-1',
 'Robust speech recognition model supporting 50+ languages.',
 'Speech-to-text transcription',
 'audio_transcription',
 '{"transcription": true, "translation": true, "timestamps": true, "multilingual": true}',
 NULL, NULL, '2023-01-01', '1.5B',
 NULL, NULL, TRUE, FALSE, TRUE, 4.5,
 '{}',
 1000, NULL),

-- TTS-1
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'TTS-1', 'tts-1', '1.0', 'tts-1',
 'Text-to-speech model with natural sounding voices.',
 'Natural text-to-speech',
 'text_to_speech',
 '{"voices": ["alloy", "echo", "fable", "onyx", "nova", "shimmer"], "streaming": true}',
 4096, NULL, '2023-11-01', NULL,
 NULL, NULL, TRUE, FALSE, FALSE, 4.4,
 '{}',
 500, NULL),

-- text-embedding-3-large
((SELECT id FROM ai_providers WHERE slug = 'openai'),
 'Embedding 3 Large', 'embedding-3-large', '3.0', 'text-embedding-3-large',
 'Most capable embedding model for search, clustering, and recommendations.',
 'High-performance embeddings',
 'embedding',
 '{"dimensions": 3072, "similarity": true, "clustering": true}',
 8191, NULL, '2024-01-01', NULL,
 0.13, NULL, TRUE, FALSE, FALSE, 4.6,
 '{"mteb": 64.6}',
 100, NULL);

-- ============================================================================
-- ANTHROPIC MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Claude 3.5 Sonnet
((SELECT id FROM ai_providers WHERE slug = 'anthropic'),
 'Claude 3.5 Sonnet', 'claude-3-5-sonnet', '20241022', 'claude-3-5-sonnet-20241022',
 'Most intelligent Claude model with computer use capabilities. Best for complex analysis and coding.',
 'Most intelligent model with computer use',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true, "computer_use": true}',
 200000, 8192, '2024-04-01', '175B',
 3.00, 15.00, TRUE, TRUE, FALSE, 4.9,
 '{"mmlu": 88.7, "humaneval": 93.7, "gpqa": 65.0}',
 350, 90),

-- Claude 3.5 Haiku
((SELECT id FROM ai_providers WHERE slug = 'anthropic'),
 'Claude 3.5 Haiku', 'claude-3-5-haiku', '20241022', 'claude-3-5-haiku-20241022',
 'Fast and affordable model for everyday tasks with strong capabilities.',
 'Fast model for everyday tasks',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true}',
 200000, 8192, '2024-04-01', '20B',
 0.80, 4.00, TRUE, TRUE, FALSE, 4.6,
 '{"mmlu": 78.0, "humaneval": 88.1}',
 150, 180),

-- Claude 3 Opus
((SELECT id FROM ai_providers WHERE slug = 'anthropic'),
 'Claude 3 Opus', 'claude-3-opus', '20240229', 'claude-3-opus-20240229',
 'Most powerful Claude 3 model for highly complex tasks requiring deep expertise.',
 'Most powerful for complex tasks',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true}',
 200000, 4096, '2024-02-01', '200B+',
 15.00, 75.00, TRUE, FALSE, FALSE, 4.8,
 '{"mmlu": 86.8, "humaneval": 84.9, "gpqa": 50.4}',
 800, 50),

-- Claude 3 Sonnet
((SELECT id FROM ai_providers WHERE slug = 'anthropic'),
 'Claude 3 Sonnet', 'claude-3-sonnet', '20240229', 'claude-3-sonnet-20240229',
 'Balance of intelligence and speed for enterprise workloads.',
 'Balanced performance for enterprises',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true}',
 200000, 4096, '2024-02-01', '70B',
 3.00, 15.00, TRUE, FALSE, FALSE, 4.5,
 '{"mmlu": 79.0, "humaneval": 73.0}',
 400, 80),

-- Claude 3 Haiku
((SELECT id FROM ai_providers WHERE slug = 'anthropic'),
 'Claude 3 Haiku', 'claude-3-haiku', '20240307', 'claude-3-haiku-20240307',
 'Fastest Claude model for quick responses and high-volume tasks.',
 'Fastest for high-volume tasks',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true}',
 200000, 4096, '2024-02-01', '20B',
 0.25, 1.25, TRUE, FALSE, FALSE, 4.4,
 '{"mmlu": 75.2, "humaneval": 75.9}',
 120, 200);

-- ============================================================================
-- GOOGLE DEEPMIND MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Gemini 2.0 Flash
((SELECT id FROM ai_providers WHERE slug = 'google'),
 'Gemini 2.0 Flash', 'gemini-2-flash', '2.0', 'gemini-2.0-flash-exp',
 'Next generation multimodal model with improved reasoning and speed.',
 'Next-gen fast multimodal model',
 'multimodal',
 '{"text": true, "vision": true, "audio": true, "video": true, "function_calling": true, "streaming": true}',
 1000000, 8192, '2024-08-01', '200B+',
 0.075, 0.30, TRUE, TRUE, FALSE, 4.7,
 '{"mmlu": 90.0, "humaneval": 89.0}',
 200, 150),

-- Gemini 1.5 Pro
((SELECT id FROM ai_providers WHERE slug = 'google'),
 'Gemini 1.5 Pro', 'gemini-15-pro', '1.5', 'gemini-1.5-pro',
 'Advanced model with 2M context window for long document analysis.',
 'Long context multimodal model',
 'multimodal',
 '{"text": true, "vision": true, "audio": true, "video": true, "function_calling": true, "streaming": true}',
 2000000, 8192, '2024-04-01', '175B',
 1.25, 5.00, TRUE, TRUE, FALSE, 4.6,
 '{"mmlu": 85.9, "humaneval": 84.1}',
 500, 70),

-- Gemini 1.5 Flash
((SELECT id FROM ai_providers WHERE slug = 'google'),
 'Gemini 1.5 Flash', 'gemini-15-flash', '1.5', 'gemini-1.5-flash',
 'Fast and efficient model for high-volume multimodal tasks.',
 'Fast multimodal model',
 'multimodal',
 '{"text": true, "vision": true, "audio": true, "video": true, "function_calling": true, "streaming": true}',
 1000000, 8192, '2024-04-01', '70B',
 0.075, 0.30, TRUE, FALSE, FALSE, 4.5,
 '{"mmlu": 78.9, "humaneval": 74.3}',
 150, 180),

-- Gemini 1.0 Pro
((SELECT id FROM ai_providers WHERE slug = 'google'),
 'Gemini 1.0 Pro', 'gemini-10-pro', '1.0', 'gemini-1.0-pro',
 'Reliable model for text generation and understanding tasks.',
 'Reliable text model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 32760, 8192, '2023-11-01', '70B',
 0.50, 1.50, TRUE, FALSE, FALSE, 4.3,
 '{"mmlu": 71.8}',
 300, 100),

-- Imagen 3
((SELECT id FROM ai_providers WHERE slug = 'google'),
 'Imagen 3', 'imagen-3', '3.0', 'imagen-3',
 'Google''s most advanced image generation model with exceptional quality.',
 'Advanced image generation',
 'image_generation',
 '{"text_to_image": true, "hd_quality": true, "photorealistic": true}',
 NULL, NULL, '2024-08-01', NULL,
 NULL, NULL, TRUE, TRUE, FALSE, 4.6,
 '{}',
 12000, NULL);

-- ============================================================================
-- META AI MODELS (via Together AI)
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Llama 3.3 70B
((SELECT id FROM ai_providers WHERE slug = 'meta'),
 'Llama 3.3 70B', 'llama-33-70b', '3.3', 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
 'Latest Llama model with multilingual support and improved reasoning.',
 'Latest open-source LLM',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "multilingual": true}',
 131072, 4096, '2024-12-01', '70B',
 0.88, 0.88, TRUE, TRUE, TRUE, 4.7,
 '{"mmlu": 86.0, "humaneval": 88.4}',
 200, 120),

-- Llama 3.2 90B Vision
((SELECT id FROM ai_providers WHERE slug = 'meta'),
 'Llama 3.2 90B Vision', 'llama-32-90b-vision', '3.2', 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
 'Multimodal Llama with vision capabilities for image understanding.',
 'Open-source vision model',
 'multimodal',
 '{"text": true, "vision": true, "streaming": true}',
 131072, 4096, '2024-09-01', '90B',
 1.20, 1.20, TRUE, TRUE, TRUE, 4.5,
 '{"mmlu": 84.0}',
 300, 90),

-- Llama 3.1 405B
((SELECT id FROM ai_providers WHERE slug = 'meta'),
 'Llama 3.1 405B', 'llama-31-405b', '3.1', 'meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo',
 'Largest open-source model rivaling GPT-4 class performance.',
 'Largest open-source LLM',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 131072, 4096, '2024-07-01', '405B',
 3.50, 3.50, TRUE, TRUE, TRUE, 4.8,
 '{"mmlu": 88.6, "humaneval": 89.0}',
 600, 50),

-- Llama 3.1 70B
((SELECT id FROM ai_providers WHERE slug = 'meta'),
 'Llama 3.1 70B', 'llama-31-70b', '3.1', 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
 'Balanced performance model for enterprise use cases.',
 'Balanced open-source model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 131072, 4096, '2024-07-01', '70B',
 0.88, 0.88, TRUE, FALSE, TRUE, 4.5,
 '{"mmlu": 83.6, "humaneval": 80.5}',
 180, 130),

-- Llama 3.1 8B
((SELECT id FROM ai_providers WHERE slug = 'meta'),
 'Llama 3.1 8B', 'llama-31-8b', '3.1', 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
 'Lightweight model for edge deployment and cost-effective inference.',
 'Lightweight efficient model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 131072, 4096, '2024-07-01', '8B',
 0.18, 0.18, TRUE, FALSE, TRUE, 4.3,
 '{"mmlu": 69.4}',
 80, 250);

-- ============================================================================
-- MISTRAL AI MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Mistral Large
((SELECT id FROM ai_providers WHERE slug = 'mistral'),
 'Mistral Large', 'mistral-large', '2411', 'mistral-large-2411',
 'Flagship model with top-tier reasoning and multilingual capabilities.',
 'Flagship reasoning model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "json_mode": true}',
 128000, 8192, '2024-11-01', '123B',
 2.00, 6.00, TRUE, TRUE, FALSE, 4.7,
 '{"mmlu": 84.0, "humaneval": 92.1}',
 350, 85),

-- Mistral Small
((SELECT id FROM ai_providers WHERE slug = 'mistral'),
 'Mistral Small', 'mistral-small', '2409', 'mistral-small-2409',
 'Cost-efficient model for everyday tasks with strong performance.',
 'Cost-efficient everyday model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "json_mode": true}',
 32000, 8192, '2024-09-01', '22B',
 0.20, 0.60, TRUE, FALSE, FALSE, 4.4,
 '{"mmlu": 72.0}',
 150, 150),

-- Codestral
((SELECT id FROM ai_providers WHERE slug = 'mistral'),
 'Codestral', 'codestral', '2405', 'codestral-2405',
 'Specialized coding model trained on 80+ programming languages.',
 'Specialized coding model',
 'code_generation',
 '{"text": true, "code": true, "streaming": true, "fill_in_middle": true}',
 32000, 8192, '2024-05-01', '22B',
 0.20, 0.60, TRUE, TRUE, FALSE, 4.6,
 '{"humaneval": 81.1, "mbpp": 78.2}',
 120, 160),

-- Mixtral 8x22B
((SELECT id FROM ai_providers WHERE slug = 'mistral'),
 'Mixtral 8x22B', 'mixtral-8x22b', '1.0', 'open-mixtral-8x22b',
 'Sparse mixture-of-experts model with efficient inference.',
 'Efficient MoE model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 65536, 8192, '2024-04-01', '176B (39B active)',
 2.00, 6.00, TRUE, FALSE, TRUE, 4.5,
 '{"mmlu": 77.8}',
 250, 100),

-- Pixtral Large
((SELECT id FROM ai_providers WHERE slug = 'mistral'),
 'Pixtral Large', 'pixtral-large', '2411', 'pixtral-large-2411',
 'Multimodal model with advanced vision understanding.',
 'Vision-language model',
 'multimodal',
 '{"text": true, "vision": true, "streaming": true}',
 128000, 8192, '2024-11-01', '124B',
 2.00, 6.00, TRUE, TRUE, FALSE, 4.5,
 '{"mmmu": 69.0}',
 400, 75);

-- ============================================================================
-- COHERE MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Command R+
((SELECT id FROM ai_providers WHERE slug = 'cohere'),
 'Command R+', 'command-r-plus', '08-2024', 'command-r-plus-08-2024',
 'Enterprise RAG model optimized for retrieval-augmented generation.',
 'Enterprise RAG model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "rag": true}',
 128000, 4096, '2024-08-01', '104B',
 2.50, 10.00, TRUE, TRUE, FALSE, 4.6,
 '{"mmlu": 75.7}',
 400, 70),

-- Command R
((SELECT id FROM ai_providers WHERE slug = 'cohere'),
 'Command R', 'command-r', '08-2024', 'command-r-08-2024',
 'Balanced model for RAG and conversational AI applications.',
 'Balanced RAG model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "rag": true}',
 128000, 4096, '2024-08-01', '35B',
 0.15, 0.60, TRUE, FALSE, FALSE, 4.4,
 '{"mmlu": 68.2}',
 200, 120),

-- Embed v3
((SELECT id FROM ai_providers WHERE slug = 'cohere'),
 'Embed v3', 'embed-v3', '3.0', 'embed-english-v3.0',
 'State-of-the-art embedding model for semantic search.',
 'Advanced embeddings',
 'embedding',
 '{"dimensions": 1024, "similarity": true, "clustering": true, "multilingual": true}',
 512, NULL, '2024-01-01', NULL,
 0.10, NULL, TRUE, FALSE, FALSE, 4.5,
 '{"mteb": 64.5}',
 50, NULL);

-- ============================================================================
-- GROQ MODELS (LPU Inference)
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Llama 3.3 70B on Groq
((SELECT id FROM ai_providers WHERE slug = 'groq'),
 'Llama 3.3 70B (Groq)', 'llama-33-70b-groq', '3.3', 'llama-3.3-70b-versatile',
 'Ultra-fast Llama 3.3 inference on Groq LPU hardware.',
 'Ultra-fast Llama 3.3',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 131072, 32768, '2024-12-01', '70B',
 0.59, 0.79, TRUE, TRUE, TRUE, 4.8,
 '{"mmlu": 86.0}',
 50, 800),

-- Mixtral 8x7B on Groq
((SELECT id FROM ai_providers WHERE slug = 'groq'),
 'Mixtral 8x7B (Groq)', 'mixtral-8x7b-groq', '1.0', 'mixtral-8x7b-32768',
 'Blazing fast Mixtral inference with 500+ tokens/second.',
 'Ultra-fast Mixtral',
 'llm',
 '{"text": true, "streaming": true}',
 32768, 32768, '2024-01-01', '46.7B (12.9B active)',
 0.24, 0.24, TRUE, FALSE, TRUE, 4.5,
 '{"mmlu": 70.6}',
 30, 500),

-- Llama 3.1 8B on Groq
((SELECT id FROM ai_providers WHERE slug = 'groq'),
 'Llama 3.1 8B (Groq)', 'llama-31-8b-groq', '3.1', 'llama-3.1-8b-instant',
 'Instant responses with Llama 3.1 8B on Groq hardware.',
 'Instant Llama responses',
 'llm',
 '{"text": true, "streaming": true}',
 131072, 8192, '2024-07-01', '8B',
 0.05, 0.08, TRUE, FALSE, TRUE, 4.4,
 '{"mmlu": 69.4}',
 20, 1000);

-- ============================================================================
-- DEEPSEEK MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- DeepSeek V3
((SELECT id FROM ai_providers WHERE slug = 'deepseek'),
 'DeepSeek V3', 'deepseek-v3', '3.0', 'deepseek-chat',
 'Most cost-efficient frontier model with GPT-4 class performance.',
 'Cost-efficient frontier model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "json_mode": true}',
 64000, 8192, '2024-12-01', '671B (37B active)',
 0.14, 0.28, TRUE, TRUE, TRUE, 4.8,
 '{"mmlu": 88.5, "humaneval": 65.2, "math": 90.2}',
 300, 100),

-- DeepSeek Coder V2
((SELECT id FROM ai_providers WHERE slug = 'deepseek'),
 'DeepSeek Coder V2', 'deepseek-coder-v2', '2.0', 'deepseek-coder',
 'Specialized coding model supporting 300+ programming languages.',
 'Advanced coding model',
 'code_generation',
 '{"text": true, "code": true, "streaming": true, "fill_in_middle": true}',
 128000, 8192, '2024-06-01', '236B (21B active)',
 0.14, 0.28, TRUE, TRUE, TRUE, 4.7,
 '{"humaneval": 90.2, "mbpp": 80.4}',
 250, 110),

-- DeepSeek Reasoner
((SELECT id FROM ai_providers WHERE slug = 'deepseek'),
 'DeepSeek Reasoner', 'deepseek-reasoner', '1.0', 'deepseek-reasoner',
 'Chain-of-thought reasoning model for complex problem solving.',
 'Advanced reasoning model',
 'llm',
 '{"text": true, "reasoning": true, "streaming": true}',
 64000, 8192, '2025-01-01', '671B',
 0.55, 2.19, TRUE, TRUE, TRUE, 4.9,
 '{"math": 97.3, "aime": 79.8}',
 1500, 60);

-- ============================================================================
-- XAI MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Grok-2
((SELECT id FROM ai_providers WHERE slug = 'xai'),
 'Grok-2', 'grok-2', '2.0', 'grok-2-1212',
 'xAI flagship model with strong reasoning and real-time knowledge.',
 'xAI flagship model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 131072, 8192, '2024-12-01', '300B+',
 2.00, 10.00, TRUE, TRUE, FALSE, 4.6,
 '{"mmlu": 87.5, "humaneval": 88.4}',
 400, 75),

-- Grok-2 Vision
((SELECT id FROM ai_providers WHERE slug = 'xai'),
 'Grok-2 Vision', 'grok-2-vision', '2.0', 'grok-2-vision-1212',
 'Multimodal Grok with image understanding capabilities.',
 'Multimodal Grok model',
 'multimodal',
 '{"text": true, "vision": true, "function_calling": true, "streaming": true}',
 32768, 8192, '2024-12-01', '300B+',
 2.00, 10.00, TRUE, FALSE, FALSE, 4.5,
 '{}',
 500, 60);

-- ============================================================================
-- PERPLEXITY MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Sonar Pro
((SELECT id FROM ai_providers WHERE slug = 'perplexity'),
 'Sonar Pro', 'sonar-pro', '1.0', 'sonar-pro',
 'Advanced search-grounded model with real-time web access.',
 'AI search with citations',
 'search',
 '{"text": true, "search": true, "citations": true, "streaming": true}',
 200000, 8192, '2025-01-01', '70B+',
 3.00, 15.00, TRUE, TRUE, FALSE, 4.7,
 '{}',
 800, 50),

-- Sonar
((SELECT id FROM ai_providers WHERE slug = 'perplexity'),
 'Sonar', 'sonar', '1.0', 'sonar',
 'Fast search model for quick web-grounded answers.',
 'Fast AI search',
 'search',
 '{"text": true, "search": true, "citations": true, "streaming": true}',
 128000, 8192, '2025-01-01', '8B',
 1.00, 1.00, TRUE, FALSE, FALSE, 4.4,
 '{}',
 300, 120);

-- ============================================================================
-- TOGETHER AI MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Qwen 2.5 72B
((SELECT id FROM ai_providers WHERE slug = 'together'),
 'Qwen 2.5 72B', 'qwen-25-72b', '2.5', 'Qwen/Qwen2.5-72B-Instruct-Turbo',
 'Powerful multilingual model with strong Chinese and English capabilities.',
 'Multilingual powerhouse',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true, "multilingual": true}',
 131072, 8192, '2024-09-01', '72B',
 0.90, 0.90, TRUE, TRUE, TRUE, 4.6,
 '{"mmlu": 85.3}',
 200, 110),

-- DeepSeek R1 on Together
((SELECT id FROM ai_providers WHERE slug = 'together'),
 'DeepSeek R1', 'deepseek-r1', '1.0', 'deepseek-ai/DeepSeek-R1',
 'Advanced reasoning model with chain-of-thought capabilities.',
 'Advanced reasoning model',
 'llm',
 '{"text": true, "reasoning": true, "streaming": true}',
 64000, 8192, '2025-01-01', '671B',
 3.00, 7.00, TRUE, TRUE, TRUE, 4.8,
 '{"math": 97.3, "aime": 79.8}',
 1200, 50);

-- ============================================================================
-- STABILITY AI MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Stable Diffusion 3.5 Large
((SELECT id FROM ai_providers WHERE slug = 'stability'),
 'Stable Diffusion 3.5 Large', 'sd-35-large', '3.5', 'sd3.5-large',
 'Most powerful Stable Diffusion model for professional image generation.',
 'Professional image generation',
 'image_generation',
 '{"text_to_image": true, "image_to_image": true, "controlnet": true}',
 NULL, NULL, '2024-10-01', '8B',
 NULL, NULL, TRUE, TRUE, TRUE, 4.7,
 '{}',
 8000, NULL),

-- Stable Diffusion 3.5 Large Turbo
((SELECT id FROM ai_providers WHERE slug = 'stability'),
 'SD 3.5 Large Turbo', 'sd-35-large-turbo', '3.5', 'sd3.5-large-turbo',
 'Fast variant of SD 3.5 with 4-step generation.',
 'Fast image generation',
 'image_generation',
 '{"text_to_image": true, "fast_generation": true}',
 NULL, NULL, '2024-10-01', '8B',
 NULL, NULL, TRUE, FALSE, TRUE, 4.5,
 '{}',
 3000, NULL),

-- Stable Video Diffusion
((SELECT id FROM ai_providers WHERE slug = 'stability'),
 'Stable Video Diffusion', 'stable-video', '1.0', 'svd',
 'Generate short video clips from images or text.',
 'Image-to-video generation',
 'video_generation',
 '{"image_to_video": true, "motion_bucket": true}',
 NULL, NULL, '2024-01-01', NULL,
 NULL, NULL, TRUE, TRUE, TRUE, 4.4,
 '{}',
 30000, NULL);

-- ============================================================================
-- ELEVENLABS MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- ElevenLabs Turbo v2.5
((SELECT id FROM ai_providers WHERE slug = 'elevenlabs'),
 'Eleven Turbo v2.5', 'eleven-turbo-v25', '2.5', 'eleven_turbo_v2_5',
 'Ultra-low latency text-to-speech with natural prosody.',
 'Ultra-fast TTS',
 'text_to_speech',
 '{"voices": true, "streaming": true, "low_latency": true, "multilingual": true}',
 5000, NULL, '2024-01-01', NULL,
 NULL, NULL, TRUE, TRUE, FALSE, 4.7,
 '{}',
 100, NULL),

-- ElevenLabs Multilingual v2
((SELECT id FROM ai_providers WHERE slug = 'elevenlabs'),
 'Eleven Multilingual v2', 'eleven-multilingual-v2', '2.0', 'eleven_multilingual_v2',
 'High-quality multilingual TTS supporting 29 languages.',
 'Multilingual TTS',
 'text_to_speech',
 '{"voices": true, "streaming": true, "multilingual": true, "emotion": true}',
 5000, NULL, '2024-01-01', NULL,
 NULL, NULL, TRUE, FALSE, FALSE, 4.6,
 '{}',
 200, NULL);

-- ============================================================================
-- RUNWAY MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Gen-3 Alpha
((SELECT id FROM ai_providers WHERE slug = 'runway'),
 'Gen-3 Alpha', 'gen3-alpha', '3.0', 'gen3a_turbo',
 'State-of-the-art video generation with temporal consistency.',
 'Advanced video generation',
 'video_generation',
 '{"text_to_video": true, "image_to_video": true, "motion_brush": true}',
 NULL, NULL, '2024-06-01', NULL,
 NULL, NULL, TRUE, TRUE, FALSE, 4.6,
 '{}',
 60000, NULL);

-- ============================================================================
-- AI21 LABS MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- Jamba 1.5 Large
((SELECT id FROM ai_providers WHERE slug = 'ai21'),
 'Jamba 1.5 Large', 'jamba-15-large', '1.5', 'jamba-1.5-large',
 'Hybrid SSM-Transformer with 256K context for long document analysis.',
 'Long context hybrid model',
 'llm',
 '{"text": true, "function_calling": true, "streaming": true}',
 256000, 8192, '2024-08-01', '398B (94B active)',
 2.00, 8.00, TRUE, TRUE, FALSE, 4.5,
 '{"mmlu": 81.2}',
 350, 80),

-- Jamba 1.5 Mini
((SELECT id FROM ai_providers WHERE slug = 'ai21'),
 'Jamba 1.5 Mini', 'jamba-15-mini', '1.5', 'jamba-1.5-mini',
 'Efficient hybrid model for cost-effective long context tasks.',
 'Efficient hybrid model',
 'llm',
 '{"text": true, "streaming": true}',
 256000, 8192, '2024-08-01', '52B (12B active)',
 0.20, 0.40, TRUE, FALSE, FALSE, 4.3,
 '{"mmlu": 72.1}',
 150, 150);

-- ============================================================================
-- REPLICATE MODELS
-- ============================================================================

INSERT INTO ai_models (
    provider_id, name, slug, version, model_identifier, description, short_description,
    model_type, capabilities, context_window, max_output_tokens, training_cutoff,
    parameters_count, input_price_per_million, output_price_per_million,
    is_available, is_featured, is_open_source, avg_rating, benchmarks, avg_latency_ms, avg_tokens_per_second
) VALUES
-- FLUX.1 Pro
((SELECT id FROM ai_providers WHERE slug = 'replicate'),
 'FLUX.1 Pro', 'flux-pro', '1.0', 'black-forest-labs/flux-pro',
 'Professional-grade image generation with exceptional prompt adherence.',
 'Pro image generation',
 'image_generation',
 '{"text_to_image": true, "high_quality": true}',
 NULL, NULL, '2024-08-01', '12B',
 NULL, NULL, TRUE, TRUE, FALSE, 4.8,
 '{}',
 10000, NULL),

-- FLUX.1 Schnell
((SELECT id FROM ai_providers WHERE slug = 'replicate'),
 'FLUX.1 Schnell', 'flux-schnell', '1.0', 'black-forest-labs/flux-schnell',
 'Fast image generation in 1-4 steps with good quality.',
 'Fast image generation',
 'image_generation',
 '{"text_to_image": true, "fast_generation": true}',
 NULL, NULL, '2024-08-01', '12B',
 NULL, NULL, TRUE, FALSE, TRUE, 4.5,
 '{}',
 2000, NULL);

-- ============================================================================
-- Update model ratings and API call counts (simulate usage)
-- ============================================================================

UPDATE ai_models SET
    total_ratings = floor(random() * 500 + 50)::int,
    total_api_calls = floor(random() * 1000000 + 10000)::bigint
WHERE is_available = TRUE;

-- ============================================================================
-- Add token exchange rates for all models
-- ============================================================================

INSERT INTO token_exchange_rates (model_id, token_type, aicaffe_tokens_per_unit, provider_cost_per_unit, margin_percentage)
SELECT
    id,
    'input',
    CEIL(input_price_per_million * 20000 * 1.20 / 1000000),  -- ACT tokens per input token
    input_price_per_million / 1000000,  -- Provider cost per token
    20.00
FROM ai_models
WHERE input_price_per_million IS NOT NULL;

INSERT INTO token_exchange_rates (model_id, token_type, aicaffe_tokens_per_unit, provider_cost_per_unit, margin_percentage)
SELECT
    id,
    'output',
    CEIL(output_price_per_million * 20000 * 1.20 / 1000000),  -- ACT tokens per output token
    output_price_per_million / 1000000,  -- Provider cost per token
    20.00
FROM ai_models
WHERE output_price_per_million IS NOT NULL;

-- ============================================================================
-- Add model features for key models
-- ============================================================================

-- GPT-4o features
INSERT INTO model_features (model_id, feature_name, feature_category, feature_value, is_supported)
SELECT id, 'Text Input', 'input_modality', 'true', TRUE FROM ai_models WHERE slug = 'gpt-4o'
UNION ALL SELECT id, 'Image Input', 'input_modality', 'true', TRUE FROM ai_models WHERE slug = 'gpt-4o'
UNION ALL SELECT id, 'Text Output', 'output_modality', 'true', TRUE FROM ai_models WHERE slug = 'gpt-4o'
UNION ALL SELECT id, 'Function Calling', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'gpt-4o'
UNION ALL SELECT id, 'JSON Mode', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'gpt-4o'
UNION ALL SELECT id, 'Streaming', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'gpt-4o';

-- Claude 3.5 Sonnet features
INSERT INTO model_features (model_id, feature_name, feature_category, feature_value, is_supported)
SELECT id, 'Text Input', 'input_modality', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet'
UNION ALL SELECT id, 'Image Input', 'input_modality', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet'
UNION ALL SELECT id, 'PDF Input', 'input_modality', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet'
UNION ALL SELECT id, 'Text Output', 'output_modality', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet'
UNION ALL SELECT id, 'Computer Use', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet'
UNION ALL SELECT id, 'Function Calling', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet'
UNION ALL SELECT id, 'Streaming', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'claude-3-5-sonnet';

-- DeepSeek V3 features
INSERT INTO model_features (model_id, feature_name, feature_category, feature_value, is_supported)
SELECT id, 'Text Input', 'input_modality', 'true', TRUE FROM ai_models WHERE slug = 'deepseek-v3'
UNION ALL SELECT id, 'Text Output', 'output_modality', 'true', TRUE FROM ai_models WHERE slug = 'deepseek-v3'
UNION ALL SELECT id, 'Function Calling', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'deepseek-v3'
UNION ALL SELECT id, 'JSON Mode', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'deepseek-v3'
UNION ALL SELECT id, 'Streaming', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'deepseek-v3'
UNION ALL SELECT id, 'Fill-in-Middle', 'capability', 'true', TRUE FROM ai_models WHERE slug = 'deepseek-v3';

-- ============================================================================
-- Add model use case scores for recommendations
-- ============================================================================

-- Code generation scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 95, 96, 85, 98, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'deepseek-v3' AND u.slug = 'code-generation'
UNION ALL
SELECT m.id, u.id, 95, 98, 80, 70, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'claude-3-5-sonnet' AND u.slug = 'code-generation'
UNION ALL
SELECT m.id, u.id, 90, 94, 85, 75, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'gpt-4o' AND u.slug = 'code-generation'
UNION ALL
SELECT m.id, u.id, 92, 90, 95, 95, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'codestral' AND u.slug = 'code-generation';

-- Blog writing scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 95, 98, 80, 75, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'claude-3-5-sonnet' AND u.slug = 'blog-writing'
UNION ALL
SELECT m.id, u.id, 95, 96, 85, 80, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'gpt-4o' AND u.slug = 'blog-writing'
UNION ALL
SELECT m.id, u.id, 90, 92, 90, 95, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'gpt-4o-mini' AND u.slug = 'blog-writing';

-- Image generation scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 98, 97, 70, 75, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'dall-e-3' AND u.slug = 'image-generation'
UNION ALL
SELECT m.id, u.id, 98, 98, 65, 80, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'flux-pro' AND u.slug = 'image-generation'
UNION ALL
SELECT m.id, u.id, 95, 96, 80, 85, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'sd-35-large' AND u.slug = 'image-generation';

-- Summarization scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 95, 95, 85, 90, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'gemini-15-pro' AND u.slug = 'summarization'
UNION ALL
SELECT m.id, u.id, 95, 96, 80, 75, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'claude-3-5-sonnet' AND u.slug = 'summarization';

-- Text to speech scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 98, 98, 95, 80, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'eleven-turbo-v25' AND u.slug = 'text-to-speech'
UNION ALL
SELECT m.id, u.id, 95, 92, 90, 90, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'tts-1' AND u.slug = 'text-to-speech';

-- Speech to text scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 98, 96, 85, 95, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'whisper' AND u.slug = 'speech-to-text';

-- Video generation scores
INSERT INTO model_use_case_scores (model_id, use_case_id, relevance_score, quality_score, speed_score, cost_efficiency_score, is_recommended)
SELECT m.id, u.id, 98, 96, 60, 70, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'gen3-alpha' AND u.slug = 'video-generation'
UNION ALL
SELECT m.id, u.id, 95, 90, 70, 85, TRUE
FROM ai_models m, use_cases u WHERE m.slug = 'stable-video' AND u.slug = 'video-generation';

COMMIT;
