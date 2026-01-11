import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Model configurations
const MODELS = {
  LLM1: {
    name: 'Fast Recall Model',
    tier: 'LLM-1',
    costWeight: 1,
    description: 'Optimized for definitions, MCQs, and factual questions'
  },
  LLM2: {
    name: 'Concept Understanding Model',
    tier: 'LLM-2',
    costWeight: 3,
    description: 'Best for explanations and examples'
  },
  LLM3: {
    name: 'Deep Reasoning Model',
    tier: 'LLM-3',
    costWeight: 5,
    description: 'Handles complex problems and multi-step reasoning'
  }
};

// Uncertainty patterns for hallucination detection
const UNCERTAINTY_PATTERNS = [
  /i think/i, /probably/i, /might be/i, /could be/i, /perhaps/i,
  /i'm not sure/i, /i believe/i, /it seems/i, /possibly/i,
  /as far as i know/i, /i assume/i, /my understanding is/i,
  /approximately/i, /roughly/i, /about/i, /around/i,
  /may or may not/i, /hard to say/i, /uncertain/i
];

// Question complexity patterns
const SIMPLE_PATTERNS = [
  /what is|define|meaning of|definition/i,
  /who is|who was|who are/i,
  /when did|when was|what year/i,
  /where is|where was/i,
  /true or false/i,
  /which of the following/i,
  /choose the correct/i,
  /select the right/i
];

const COMPLEX_PATTERNS = [
  /explain why|explain how|why does|how does/i,
  /compare and contrast|analyze|evaluate/i,
  /prove that|derive|demonstrate/i,
  /step by step|show your work/i,
  /what would happen if|predict/i,
  /design a|create a solution/i,
  /critically assess|discuss the implications/i
];

function analyzeComplexity(question: string): 'simple' | 'medium' | 'complex' {
  const lowerQuestion = question.toLowerCase();
  const wordCount = question.split(/\s+/).length;
  
  // Check for complex patterns first
  if (COMPLEX_PATTERNS.some(pattern => pattern.test(question))) {
    return 'complex';
  }
  
  // Check for simple patterns
  if (SIMPLE_PATTERNS.some(pattern => pattern.test(question))) {
    return 'simple';
  }
  
  // Use word count as a heuristic
  if (wordCount > 30) return 'complex';
  if (wordCount < 10) return 'simple';
  
  return 'medium';
}

function calculateHallucinationScore(response: string): number {
  let score = 0;
  let matchCount = 0;
  
  for (const pattern of UNCERTAINTY_PATTERNS) {
    if (pattern.test(response)) {
      matchCount++;
    }
  }
  
  // Base score from uncertainty patterns (0 to 0.5)
  score = Math.min(matchCount * 0.1, 0.5);
  
  // Add penalty for very short responses (might be incomplete)
  if (response.length < 50) score += 0.15;
  
  // Add penalty for very long responses (might be rambling)
  if (response.length > 2000) score += 0.1;
  
  // Cap at 1.0
  return Math.min(score, 1.0);
}

// Confidence patterns for language certainty detection
const CONFIDENT_PATTERNS = [
  /is defined as/i, /refers to/i, /means that/i, /specifically/i,
  /precisely/i, /exactly/i, /certainly/i, /definitely/i,
  /the answer is/i, /the result is/i, /equals/i, /this is because/i,
  /in fact/i, /indeed/i, /clearly/i, /obviously/i
];

function calculateConfidenceScore(response: string): number {
  let confidenceMatches = 0;
  let uncertaintyMatches = 0;
  
  for (const pattern of CONFIDENT_PATTERNS) {
    if (pattern.test(response)) confidenceMatches++;
  }
  
  for (const pattern of UNCERTAINTY_PATTERNS) {
    if (pattern.test(response)) uncertaintyMatches++;
  }
  
  // Start with a baseline confidence
  let confidence = 0.6;
  
  // Increase confidence for confident language
  confidence += Math.min(confidenceMatches * 0.08, 0.3);
  
  // Decrease confidence for uncertain language
  confidence -= Math.min(uncertaintyMatches * 0.1, 0.4);
  
  // Bonus for well-structured responses
  const hasBulletPoints = /^[\s]*[-•*]/m.test(response);
  const hasNumbering = /^[\s]*\d+\./m.test(response);
  if (hasBulletPoints || hasNumbering) confidence += 0.1;
  
  return Math.max(0, Math.min(confidence, 1.0));
}

function calculateContextCompleteness(question: string, response: string): number {
  // Extract key terms from the question
  const questionWords = question.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3);
  
  const responseWords = new Set(
    response.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
  );
  
  // Check how many question terms appear in response
  const coveredTerms = questionWords.filter(w => responseWords.has(w));
  const termCoverage = questionWords.length > 0 
    ? coveredTerms.length / questionWords.length 
    : 0.5;
  
  // Check response length relative to question complexity
  const questionComplexity = questionWords.length;
  const expectedMinLength = questionComplexity * 20;
  const lengthScore = Math.min(response.length / Math.max(expectedMinLength, 100), 1);
  
  // Combine scores
  return Math.min((termCoverage * 0.6) + (lengthScore * 0.4), 1.0);
}

interface TrustMetrics {
  trustScore: number;
  confidenceScore: number;
  contextCompletenessScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

function calculateTrustScore(
  question: string, 
  response: string, 
  hallucinationScore: number,
  trustPenalty: number = 0
): TrustMetrics {
  const confidenceScore = calculateConfidenceScore(response);
  const contextCompletenessScore = calculateContextCompleteness(question, response);
  
  // Trust Score formula:
  // (Confidence × 0.3) + ((1 − Hallucination) × 0.4) + (Context Completeness × 0.3)
  let trustScore = 
    (confidenceScore * 0.3) + 
    ((1 - hallucinationScore) * 0.4) + 
    (contextCompletenessScore * 0.3);
  
  // Apply learning loop penalty from previous overrides
  trustScore = Math.max(0, trustScore - trustPenalty);
  
  // Normalize to 0-100
  const normalizedTrustScore = Math.round(trustScore * 100);
  
  // Risk classification
  let riskLevel: 'low' | 'medium' | 'high';
  if (normalizedTrustScore <= 40) {
    riskLevel = 'high';
  } else if (normalizedTrustScore <= 70) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }
  
  return {
    trustScore: normalizedTrustScore,
    confidenceScore: Math.round(confidenceScore * 100) / 100,
    contextCompletenessScore: Math.round(contextCompletenessScore * 100) / 100,
    riskLevel
  };
}

function selectModel(complexity: 'simple' | 'medium' | 'complex') {
  switch (complexity) {
    case 'simple': return MODELS.LLM1;
    case 'medium': return MODELS.LLM2;
    case 'complex': return MODELS.LLM3;
  }
}

function calculateCostSaved(usedModel: typeof MODELS.LLM1): number {
  // Cost saved compared to always using LLM-3
  const maxCost = MODELS.LLM3.costWeight;
  const actualCost = usedModel.costWeight;
  return Math.round(((maxCost - actualCost) / maxCost) * 100);
}

// LLM-1: Gemini Flash Lite (Fast Recall - Definitions & Facts)
async function callGeminiFlashLite(question: string, apiKey: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: 'You are an educational assistant. Provide short, accurate, factual answers.' },
        { role: 'user', content: question }
      ],
      max_tokens: 512,
      temperature: 0.3
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini Flash Lite API error:', error);
    throw new Error(`Gemini Flash Lite API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Unable to generate response';
}

// LLM-2: Groq llama-3.1-8b-instant (Concept Understanding - Explanations)
async function callGroq(question: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are an educational assistant. Provide clear, detailed explanations with examples when helpful.' },
        { role: 'user', content: question }
      ],
      temperature: 0.4,
      max_tokens: 1500
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Groq API error:', error);
    throw new Error(`Groq API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Unable to generate response';
}

// LLM-3: Gemini Pro (Deep Reasoning - Step-by-Step)
async function callGeminiPro(question: string, apiKey: string): Promise<string> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-pro',
      messages: [
        { role: 'system', content: 'You are an expert educational tutor. Provide thorough, step-by-step explanations for complex problems. Show your reasoning clearly.' },
        { role: 'user', content: question }
      ],
      max_tokens: 2000,
      temperature: 0.5
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini Pro API error:', error);
    throw new Error(`Gemini Pro API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Unable to generate response';
}

async function callModel(model: typeof MODELS.LLM1, question: string): Promise<{ answer: string; actualModel: typeof MODELS.LLM1 }> {
  const groqKey = Deno.env.get('GROQ_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  
  // Define fallback order: try requested model first, then fallback to others
  const modelOrder = model.tier === 'LLM-1' 
    ? [MODELS.LLM1, MODELS.LLM2, MODELS.LLM3]
    : model.tier === 'LLM-2'
    ? [MODELS.LLM2, MODELS.LLM1, MODELS.LLM3]
    : [MODELS.LLM3, MODELS.LLM2, MODELS.LLM1];
  
  for (const tryModel of modelOrder) {
    try {
      let answer: string;
      switch (tryModel.tier) {
        case 'LLM-1':
          if (!lovableKey) continue;
          console.log('Calling Gemini Flash Lite (LLM-1)');
          answer = await callGeminiFlashLite(question, lovableKey);
          break;
        case 'LLM-2':
          if (!groqKey) continue;
          console.log('Calling Groq Llama 3.1 (LLM-2)');
          answer = await callGroq(question, groqKey);
          break;
        case 'LLM-3':
          if (!lovableKey) continue;
          console.log('Calling Gemini Pro (LLM-3)');
          answer = await callGeminiPro(question, lovableKey);
          break;
        default:
          continue;
      }
      console.log(`Successfully used model: ${tryModel.name}`);
      return { answer, actualModel: tryModel };
    } catch (error) {
      console.error(`Model ${tryModel.name} failed:`, error);
      continue; // Try next model in fallback order
    }
  }
  
  throw new Error('All AI models failed. Please try again later.');
}

async function checkCache(supabase: any, question: string): Promise<any | null> {
  // Simple keyword-based cache lookup (could be enhanced with embeddings)
  const keywords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  
  if (keywords.length === 0) return null;
  
  const { data, error } = await supabase
    .from('questions_cache')
    .select('*')
    .textSearch('question', keywords.join(' | '), { type: 'websearch' })
    .limit(1);
  
  if (error || !data || data.length === 0) return null;
  
  // Check if the cached question is similar enough (simple heuristic)
  const cached = data[0];
  const cachedWords = new Set(cached.question.toLowerCase().split(/\s+/));
  const questionWords = new Set(question.toLowerCase().split(/\s+/));
  const intersection = [...questionWords].filter(w => cachedWords.has(w));
  const similarity = intersection.length / Math.max(cachedWords.size, questionWords.size);
  
  if (similarity > 0.7) {
    return cached;
  }
  
  return null;
}

async function saveToCache(supabase: any, question: string, answer: string, modelUsed: string, modelTier: string, hallucinationScore: number) {
  await supabase.from('questions_cache').insert({
    question,
    answer,
    model_used: modelUsed,
    model_tier: modelTier,
    hallucination_score: hallucinationScore
  });
}

async function logQuery(supabase: any, data: any) {
  await supabase.from('query_logs').insert(data);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { question, forcedModelTier } = await req.json();
    
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Question is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Step 1: Check semantic cache (skip if model is forced)
    if (!forcedModelTier) {
      console.log('Checking cache for:', question.substring(0, 50));
      const cached = await checkCache(supabase, question);
      
      if (cached) {
        console.log('Cache hit!');
        const responseTime = Date.now() - startTime;
        
        // Calculate trust score for cached response (apply any penalty from learning loop)
        const trustPenalty = cached.trust_penalty || 0;
        const trustMetrics = calculateTrustScore(
          question, 
          cached.answer, 
          Number(cached.hallucination_score),
          trustPenalty
        );
        
        await logQuery(supabase, {
          question,
          answer: cached.answer,
          model_used: cached.model_used,
          model_tier: cached.model_tier,
          hallucination_score: cached.hallucination_score,
          cost_saved_percentage: 100,
          cache_hit: true,
          routing_reason: 'Retrieved from semantic cache',
          response_time_ms: responseTime,
          was_escalated: false,
          trust_score: trustMetrics.trustScore,
          risk_level: trustMetrics.riskLevel,
          confidence_score: trustMetrics.confidenceScore,
          context_completeness_score: trustMetrics.contextCompletenessScore
        });
        
        return new Response(JSON.stringify({
          answer: cached.answer,
          hallucination_score: Number(cached.hallucination_score),
          model_used: cached.model_used,
          model_tier: cached.model_tier,
          cost_saved: '100%',
          cache_hit: true,
          routing_reason: 'Retrieved from semantic cache - 0 AI calls needed!',
          response_time_ms: responseTime,
          trust_score: trustMetrics.trustScore,
          risk_level: trustMetrics.riskLevel,
          confidence_score: trustMetrics.confidenceScore,
          context_completeness_score: trustMetrics.contextCompletenessScore
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Step 2: Determine model - use forced tier or auto-select based on complexity
    let selectedModel: typeof MODELS.LLM1;
    let routingReason: string;
    
    if (forcedModelTier && ['LLM-1', 'LLM-2', 'LLM-3'].includes(forcedModelTier)) {
      // User manually selected a model
      selectedModel = forcedModelTier === 'LLM-1' ? MODELS.LLM1 : 
                      forcedModelTier === 'LLM-2' ? MODELS.LLM2 : MODELS.LLM3;
      routingReason = `Manually selected: ${selectedModel.name}`;
      console.log('User forced model:', selectedModel.name);
    } else {
      // Auto-select based on complexity
      const complexity = analyzeComplexity(question);
      console.log('Query complexity:', complexity);
      selectedModel = selectModel(complexity);
      routingReason = `${complexity.charAt(0).toUpperCase() + complexity.slice(1)} question routed to ${selectedModel.name}`;
    }
    
    // Step 4: Call the model
    console.log('Calling model:', selectedModel.name);
    let modelResult = await callModel(selectedModel, question);
    let answer = modelResult.answer;
    selectedModel = modelResult.actualModel; // Update to actual model used (in case of fallback)
    
    // Step 5: Calculate hallucination score
    let hallucinationScore = calculateHallucinationScore(answer);
    let wasEscalated = false;
    
    // Step 6: Escalate if hallucination score is too high
    if (hallucinationScore > 0.6 && selectedModel.tier !== 'LLM-3') {
      console.log('High hallucination detected, escalating to LLM-3');
      const previousModel = selectedModel;
      
      try {
        const escalatedResult = await callModel(MODELS.LLM3, question);
        answer = escalatedResult.answer;
        selectedModel = escalatedResult.actualModel;
        hallucinationScore = calculateHallucinationScore(answer);
        wasEscalated = true;
        routingReason = `Escalated from ${previousModel.name} due to high uncertainty (score: ${hallucinationScore.toFixed(2)})`;
      } catch (escalationError) {
        console.error('Escalation failed, using original response');
        selectedModel = previousModel;
      }
    }
    
    const responseTime = Date.now() - startTime;
    const costSaved = calculateCostSaved(selectedModel);
    
    // Step 7: Calculate trust score
    const trustMetrics = calculateTrustScore(question, answer, hallucinationScore);
    console.log('Trust metrics:', trustMetrics);
    
    // Step 8: Save to cache
    await saveToCache(supabase, question, answer, selectedModel.name, selectedModel.tier, hallucinationScore);
    
    // Step 9: Log the query with trust metrics
    await logQuery(supabase, {
      question,
      answer,
      model_used: selectedModel.name,
      model_tier: selectedModel.tier,
      hallucination_score: hallucinationScore,
      cost_saved_percentage: costSaved,
      cache_hit: false,
      routing_reason: routingReason,
      response_time_ms: responseTime,
      was_escalated: wasEscalated,
      trust_score: trustMetrics.trustScore,
      risk_level: trustMetrics.riskLevel,
      confidence_score: trustMetrics.confidenceScore,
      context_completeness_score: trustMetrics.contextCompletenessScore
    });

    return new Response(JSON.stringify({
      answer,
      hallucination_score: hallucinationScore,
      model_used: selectedModel.name,
      model_tier: selectedModel.tier,
      cost_saved: `${costSaved}%`,
      cache_hit: false,
      routing_reason: routingReason,
      response_time_ms: responseTime,
      was_escalated: wasEscalated,
      trust_score: trustMetrics.trustScore,
      risk_level: trustMetrics.riskLevel,
      confidence_score: trustMetrics.confidenceScore,
      context_completeness_score: trustMetrics.contextCompletenessScore
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in ask function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
