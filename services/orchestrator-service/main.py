"""
AICaffe Meta-Agent Orchestrator Service
Master agent that coordinates multiple AI agents, delegates tasks, and synthesizes responses
to provide unified, high-quality outputs for customers.
"""
from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime
from enum import Enum
import asyncpg
import httpx
import asyncio
import uuid
import os
import json
import re
from dataclasses import dataclass

app = FastAPI(title="AICaffe Orchestrator Service", version="1.0.0")

# ── Configuration ─────────────────────────────────────────────────────────────

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", 5432)),
    "user": os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", "postgres"),
    "database": os.getenv("DB_NAME", "aicaffe"),
}

# Service URLs
AI_PROXY_URL = os.getenv("AI_PROXY_URL", "http://localhost:8006")
WORKSPACE_SERVICE_URL = os.getenv("WORKSPACE_SERVICE_URL", "http://localhost:8009")

# Orchestrator models — use free-tier providers
ORCHESTRATOR_MODEL = "llama-3.3-70b-versatile"   # Groq — fast + capable
SYNTHESIS_MODEL = "llama-3.3-70b-versatile"       # Groq
FAST_MODEL = "llama-3.1-8b-instant"               # Groq — fast for analysis

# Cache for model identifier → DB UUID resolution
_model_id_cache: Dict[str, str] = {}

# ── Database ──────────────────────────────────────────────────────────────────

pool: Optional[asyncpg.Pool] = None

async def get_pool():
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(**DB_CONFIG, min_size=5, max_size=20)
    return pool

# ── Schemas ───────────────────────────────────────────────────────────────────

class TaskType(str, Enum):
    """Types of orchestrated tasks"""
    simple = "simple"           # Single agent, direct response
    parallel = "parallel"       # Multiple agents in parallel, synthesized
    sequential = "sequential"   # Agents in sequence, each builds on previous
    debate = "debate"           # Multiple perspectives, best answer selected
    consensus = "consensus"     # Multiple agents, find common ground
    expert_panel = "expert_panel"  # Domain experts collaborate

class AgentRole(str, Enum):
    """Roles agents can play in orchestration"""
    researcher = "researcher"
    analyst = "analyst"
    writer = "writer"
    critic = "critic"
    synthesizer = "synthesizer"
    fact_checker = "fact_checker"
    creative = "creative"
    technical = "technical"

class OrchestrateRequest(BaseModel):
    """Request for orchestrated multi-agent task"""
    prompt: str = Field(..., description="The user's request")
    task_type: TaskType = Field(default=TaskType.simple, description="Type of orchestration")
    agents: Optional[List[str]] = Field(default=None, description="Specific agent IDs to use")
    roles: Optional[List[AgentRole]] = Field(default=None, description="Roles to assign to agents")
    max_agents: int = Field(default=3, ge=1, le=5, description="Maximum agents to use")
    require_consensus: bool = Field(default=False, description="Require agent consensus")
    quality_threshold: float = Field(default=0.7, ge=0, le=1, description="Minimum quality score")
    include_reasoning: bool = Field(default=True, description="Include reasoning in response")
    timeout_seconds: int = Field(default=120, ge=10, le=300)
    preferences: Optional[Dict[str, Any]] = Field(default=None, description="User preferences e.g. model_override")

class AgentResponse(BaseModel):
    """Individual agent's response"""
    agent_id: str
    agent_name: str
    role: str
    response: str
    confidence: float
    tokens_used: int
    latency_ms: int
    model_used: str

class OrchestratedResponse(BaseModel):
    """Final orchestrated response"""
    id: str
    task_type: TaskType
    final_response: str
    summary: str
    agent_responses: List[AgentResponse]
    synthesis_reasoning: Optional[str]
    quality_score: float
    consensus_reached: bool
    total_tokens: int
    total_latency_ms: int
    metadata: Dict[str, Any]

class SmartQueryRequest(BaseModel):
    """Smart query that auto-determines best approach"""
    query: str
    context: Optional[str] = None
    preferences: Optional[Dict[str, Any]] = None

class WorkflowStep(BaseModel):
    """Step in a multi-agent workflow"""
    agent_role: AgentRole
    instruction: str
    depends_on: Optional[List[int]] = None
    model_override: Optional[str] = None

class WorkflowRequest(BaseModel):
    """Custom workflow request"""
    name: str
    description: Optional[str] = None
    steps: List[WorkflowStep]
    initial_input: str
    merge_strategy: Literal["concatenate", "synthesize", "best_of"] = "synthesize"

# ── Built-in Expert Agents ────────────────────────────────────────────────────

EXPERT_AGENTS = {
    "researcher": {
        "name": "Research Expert",
        "system_prompt": """You are an expert researcher. Your role is to:
- Find accurate, up-to-date information
- Cite sources and evidence
- Identify gaps in knowledge
- Present multiple perspectives
Be thorough but concise. Focus on facts over opinions.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": ["web_search", "document_reader"]
    },
    "analyst": {
        "name": "Analysis Expert",
        "system_prompt": """You are an expert analyst. Your role is to:
- Break down complex problems
- Identify patterns and insights
- Provide data-driven recommendations
- Consider risks and trade-offs
Be analytical and structured in your reasoning.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": ["code_interpreter", "calculator"]
    },
    "writer": {
        "name": "Writing Expert",
        "system_prompt": """You are an expert writer. Your role is to:
- Craft clear, engaging content
- Adapt tone for the audience
- Structure information effectively
- Make complex topics accessible
Focus on clarity and impact.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": []
    },
    "critic": {
        "name": "Critical Reviewer",
        "system_prompt": """You are a critical reviewer. Your role is to:
- Identify weaknesses and gaps
- Challenge assumptions
- Suggest improvements
- Ensure quality and accuracy
Be constructive but thorough in your critique.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": []
    },
    "synthesizer": {
        "name": "Synthesis Expert",
        "system_prompt": """You are an expert at synthesis. Your role is to:
- Combine multiple viewpoints coherently
- Identify common themes
- Resolve contradictions
- Create unified, actionable outputs
Focus on creating value from diverse inputs.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": []
    },
    "fact_checker": {
        "name": "Fact Checker",
        "system_prompt": """You are a fact checker. Your role is to:
- Verify claims and statements
- Identify misinformation
- Provide corrections with sources
- Rate confidence in factual accuracy
Be rigorous and cite evidence.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": ["web_search"]
    },
    "creative": {
        "name": "Creative Expert",
        "system_prompt": """You are a creative expert. Your role is to:
- Generate innovative ideas
- Think outside conventional boundaries
- Provide unique perspectives
- Suggest creative solutions
Be bold and imaginative.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": ["image_generation"]
    },
    "technical": {
        "name": "Technical Expert",
        "system_prompt": """You are a technical expert. Your role is to:
- Provide accurate technical information
- Write clean, efficient code
- Explain complex concepts clearly
- Suggest best practices
Be precise and thorough.""",
        "model": "llama-3.3-70b-versatile",
        "capabilities": ["code_interpreter"]
    }
}

# ── Orchestrator Engine ───────────────────────────────────────────────────────

class OrchestratorEngine:
    """Core orchestration logic"""

    def __init__(self):
        self.http_client: Optional[httpx.AsyncClient] = None

    async def get_client(self) -> httpx.AsyncClient:
        if self.http_client is None:
            self.http_client = httpx.AsyncClient(timeout=120.0)
        return self.http_client

    async def resolve_model_id(self, model_identifier: str) -> str:
        """Resolve a model identifier (e.g. 'llama-3.3-70b-versatile') to its DB UUID"""
        if model_identifier in _model_id_cache:
            return _model_id_cache[model_identifier]
        db = await get_pool()
        async with db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id FROM ai_models WHERE model_identifier = $1 AND status = 'active' LIMIT 1",
                model_identifier
            )
            if row:
                _model_id_cache[model_identifier] = str(row["id"])
                return _model_id_cache[model_identifier]
        # If not found, return as-is (maybe it's already a UUID)
        return model_identifier

    async def call_ai(self, model: str, messages: List[Dict], user_id: str, **kwargs) -> Dict:
        """Call AI model via proxy"""
        client = await self.get_client()
        model_id = await self.resolve_model_id(model)
        # Remove non-API fields from kwargs
        safe_kwargs = {k: v for k, v in kwargs.items() if k in ("temperature", "max_tokens", "tools")}
        try:
            response = await client.post(
                f"{AI_PROXY_URL}/api/v1/chat/completions",
                json={
                    "model_id": model_id,
                    "messages": [{"role": m["role"], "content": m["content"]} for m in messages],
                    **safe_kwargs
                },
                headers={"X-User-ID": user_id}
            )
            if response.status_code == 200:
                return response.json()
            else:
                error_detail = "AI call failed"
                try:
                    error_detail = response.json().get("detail", response.text[:200])
                except Exception:
                    error_detail = response.text[:200]
                print(f"[orchestrator] AI call failed ({response.status_code}): {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=f"AI call failed: {error_detail}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"[orchestrator] AI call exception: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def analyze_query(self, query: str, user_id: str) -> Dict:
        """Analyze query to determine best orchestration approach"""
        analysis_prompt = f"""Analyze this user query and determine:
1. complexity (simple/moderate/complex)
2. best_task_type (simple/parallel/sequential/debate/consensus/expert_panel)
3. required_roles (list of: researcher, analyst, writer, critic, synthesizer, fact_checker, creative, technical)
4. estimated_agents (1-5)
5. key_topics (list of main topics)
6. requires_factual_accuracy (true/false)
7. requires_creativity (true/false)
8. requires_technical_depth (true/false)

Query: {query}

Respond in JSON format only."""

        result = await self.call_ai(
            model=FAST_MODEL,
            messages=[{"role": "user", "content": analysis_prompt}],
            user_id=user_id,
            temperature=0.3,
            max_tokens=500
        )

        content = result.get("choices", [{}])[0].get("message", {}).get("content", "{}")

        # Parse JSON from response
        try:
            # Extract JSON from potential markdown code block
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass

        # Default analysis
        return {
            "complexity": "moderate",
            "best_task_type": "parallel",
            "required_roles": ["researcher", "analyst", "writer"],
            "estimated_agents": 3,
            "key_topics": [],
            "requires_factual_accuracy": True,
            "requires_creativity": False,
            "requires_technical_depth": False
        }

    async def run_agent(
        self,
        role: str,
        prompt: str,
        context: str,
        user_id: str
    ) -> AgentResponse:
        """Execute a single agent with its role"""
        agent_config = EXPERT_AGENTS.get(role, EXPERT_AGENTS["analyst"])
        start_time = datetime.now()

        messages = [
            {"role": "system", "content": agent_config["system_prompt"]},
            {"role": "user", "content": f"Context: {context}\n\nTask: {prompt}"}
        ]

        result = await self.call_ai(
            model=agent_config["model"],
            messages=messages,
            user_id=user_id,
            temperature=0.7,
            max_tokens=2048
        )

        latency = int((datetime.now() - start_time).total_seconds() * 1000)
        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = result.get("usage", {})

        return AgentResponse(
            agent_id=f"builtin_{role}",
            agent_name=agent_config["name"],
            role=role,
            response=content,
            confidence=0.8,  # Could be calculated from response
            tokens_used=usage.get("total_tokens", 0),
            latency_ms=latency,
            model_used=agent_config["model"]
        )

    async def run_parallel_agents(
        self,
        roles: List[str],
        prompt: str,
        context: str,
        user_id: str
    ) -> List[AgentResponse]:
        """Run multiple agents in parallel"""
        tasks = [
            self.run_agent(role, prompt, context, user_id)
            for role in roles
        ]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def synthesize_responses(
        self,
        responses: List[AgentResponse],
        original_prompt: str,
        user_id: str
    ) -> Dict:
        """Synthesize multiple agent responses into unified output"""
        responses_text = "\n\n".join([
            f"**{r.agent_name} ({r.role}):**\n{r.response}"
            for r in responses if isinstance(r, AgentResponse)
        ])

        synthesis_prompt = f"""You are synthesizing responses from multiple expert agents.

Original User Request: {original_prompt}

Agent Responses:
{responses_text}

Your task:
1. Identify the key insights from each expert
2. Resolve any contradictions or disagreements
3. Combine the best elements into a unified, comprehensive response
4. Ensure the final response directly addresses the user's request
5. Maintain accuracy while being concise

Provide your synthesis in this format:
## Summary
[2-3 sentence summary]

## Detailed Response
[Your synthesized response]

## Key Insights
- [Bullet points of most important takeaways]

## Confidence Level
[High/Medium/Low] - [Brief explanation]"""

        result = await self.call_ai(
            model=SYNTHESIS_MODEL,
            messages=[{"role": "user", "content": synthesis_prompt}],
            user_id=user_id,
            temperature=0.5,
            max_tokens=3000
        )

        content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        usage = result.get("usage", {})

        # Extract summary
        summary_match = re.search(r'## Summary\s*\n(.*?)(?=\n##|\Z)', content, re.DOTALL)
        summary = summary_match.group(1).strip() if summary_match else content[:200]

        # Calculate quality score based on response characteristics
        quality_indicators = [
            len(content) > 500,  # Sufficient detail
            "## " in content,    # Proper structure
            any(r.confidence > 0.7 for r in responses if isinstance(r, AgentResponse)),
            len([r for r in responses if isinstance(r, AgentResponse)]) >= 2
        ]
        quality_score = sum(quality_indicators) / len(quality_indicators)

        return {
            "response": content,
            "summary": summary,
            "quality_score": quality_score,
            "tokens_used": usage.get("total_tokens", 0)
        }

    async def run_debate(
        self,
        roles: List[str],
        prompt: str,
        user_id: str,
        rounds: int = 2
    ) -> Dict:
        """Run a debate between agents to find best answer"""
        debate_history = []
        context = f"Debate Topic: {prompt}"

        for round_num in range(rounds):
            round_responses = []
            for role in roles:
                debate_prompt = f"""Round {round_num + 1} of debate.

Previous arguments:
{chr(10).join(debate_history) if debate_history else 'None yet.'}

Present your argument on: {prompt}

If others have argued, respond to their points while making your own case."""

                response = await self.run_agent(role, debate_prompt, context, user_id)
                round_responses.append(response)
                debate_history.append(f"{response.agent_name}: {response.response[:500]}...")

        # Final synthesis after debate
        return {
            "responses": round_responses,
            "debate_history": debate_history
        }

    async def run_sequential(
        self,
        workflow: List[Dict],
        initial_input: str,
        user_id: str
    ) -> List[AgentResponse]:
        """Run agents sequentially, each building on previous"""
        responses = []
        current_context = initial_input

        for step in workflow:
            role = step.get("role", "analyst")
            instruction = step.get("instruction", "Continue the task")

            response = await self.run_agent(
                role=role,
                prompt=instruction,
                context=current_context,
                user_id=user_id
            )
            responses.append(response)
            current_context = f"Previous output:\n{response.response}\n\nOriginal request: {initial_input}"

        return responses

    async def orchestrate(
        self,
        request: OrchestrateRequest,
        user_id: str
    ) -> OrchestratedResponse:
        """Main orchestration method"""
        orchestration_id = str(uuid.uuid4())
        start_time = datetime.now()

        # Determine roles to use
        roles = [r.value for r in request.roles] if request.roles else None

        if not roles:
            # Auto-determine based on query analysis
            analysis = await self.analyze_query(request.prompt, user_id)
            roles = analysis.get("required_roles", ["researcher", "analyst", "writer"])[:request.max_agents]

        agent_responses = []
        synthesis_result = None

        if request.task_type == TaskType.simple:
            # Single best agent
            role = roles[0] if roles else "analyst"
            response = await self.run_agent(role, request.prompt, "", user_id)
            agent_responses = [response]
            final_response = response.response
            summary = response.response[:200]
            quality_score = response.confidence

        elif request.task_type == TaskType.parallel:
            # Run agents in parallel and synthesize
            responses = await self.run_parallel_agents(roles, request.prompt, "", user_id)
            agent_responses = [r for r in responses if isinstance(r, AgentResponse)]
            synthesis_result = await self.synthesize_responses(agent_responses, request.prompt, user_id)
            final_response = synthesis_result["response"]
            summary = synthesis_result["summary"]
            quality_score = synthesis_result["quality_score"]

        elif request.task_type == TaskType.sequential:
            # Run agents in sequence
            workflow = [{"role": role, "instruction": request.prompt} for role in roles]
            agent_responses = await self.run_sequential(workflow, request.prompt, user_id)
            final_response = agent_responses[-1].response if agent_responses else ""
            summary = final_response[:200]
            quality_score = sum(r.confidence for r in agent_responses) / len(agent_responses) if agent_responses else 0

        elif request.task_type == TaskType.debate:
            # Run debate between agents
            debate_result = await self.run_debate(roles[:3], request.prompt, user_id)
            agent_responses = debate_result["responses"]
            synthesis_result = await self.synthesize_responses(agent_responses, request.prompt, user_id)
            final_response = synthesis_result["response"]
            summary = synthesis_result["summary"]
            quality_score = synthesis_result["quality_score"]

        elif request.task_type == TaskType.consensus:
            # Run parallel and find consensus
            responses = await self.run_parallel_agents(roles, request.prompt, "", user_id)
            agent_responses = [r for r in responses if isinstance(r, AgentResponse)]

            # Consensus synthesis
            consensus_prompt = f"""Find the consensus among these expert opinions:

{chr(10).join([f'{r.agent_name}: {r.response}' for r in agent_responses])}

Identify:
1. Points of agreement
2. Points of disagreement
3. The most reliable consensus view
4. Remaining uncertainties"""

            consensus_result = await self.call_ai(
                model=SYNTHESIS_MODEL,
                messages=[{"role": "user", "content": consensus_prompt}],
                user_id=user_id
            )
            final_response = consensus_result.get("choices", [{}])[0].get("message", {}).get("content", "")
            summary = "Consensus view from multiple experts"
            quality_score = 0.85 if len(agent_responses) >= 2 else 0.7

        elif request.task_type == TaskType.expert_panel:
            # Expert panel discussion
            panel_roles = ["researcher", "analyst", "critic", "synthesizer"][:request.max_agents]
            responses = await self.run_parallel_agents(panel_roles, request.prompt, "", user_id)
            agent_responses = [r for r in responses if isinstance(r, AgentResponse)]

            # Panel moderator synthesis
            synthesis_result = await self.synthesize_responses(agent_responses, request.prompt, user_id)
            final_response = synthesis_result["response"]
            summary = synthesis_result["summary"]
            quality_score = synthesis_result["quality_score"]

        else:
            # Default to parallel
            responses = await self.run_parallel_agents(roles, request.prompt, "", user_id)
            agent_responses = [r for r in responses if isinstance(r, AgentResponse)]
            synthesis_result = await self.synthesize_responses(agent_responses, request.prompt, user_id)
            final_response = synthesis_result["response"]
            summary = synthesis_result["summary"]
            quality_score = synthesis_result["quality_score"]

        total_latency = int((datetime.now() - start_time).total_seconds() * 1000)
        total_tokens = sum(r.tokens_used for r in agent_responses)
        if synthesis_result:
            total_tokens += synthesis_result.get("tokens_used", 0)

        return OrchestratedResponse(
            id=orchestration_id,
            task_type=request.task_type,
            final_response=final_response,
            summary=summary,
            agent_responses=agent_responses,
            synthesis_reasoning=synthesis_result.get("response") if synthesis_result and request.include_reasoning else None,
            quality_score=quality_score,
            consensus_reached=quality_score >= request.quality_threshold,
            total_tokens=total_tokens,
            total_latency_ms=total_latency,
            metadata={
                "roles_used": roles,
                "agents_count": len(agent_responses),
                "task_type": request.task_type.value
            }
        )

orchestrator = OrchestratorEngine()

# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "orchestrator"}

@app.post("/api/v1/orchestrate", response_model=OrchestratedResponse)
async def orchestrate_task(
    request: OrchestrateRequest,
    user_id: str = Query(...)
):
    """
    Orchestrate a multi-agent task.

    Task types:
    - simple: Single agent, direct response
    - parallel: Multiple agents work simultaneously, responses synthesized
    - sequential: Agents work in sequence, each building on previous
    - debate: Agents debate the topic, best arguments selected
    - consensus: Find common ground among multiple perspectives
    - expert_panel: Domain experts collaborate on the problem
    """
    return await orchestrator.orchestrate(request, user_id)

@app.post("/api/v1/smart-query")
async def smart_query(
    request: SmartQueryRequest,
    user_id: str = Query(...)
):
    """
    Smart query endpoint that automatically determines the best approach.
    Analyzes the query and selects optimal agents and orchestration strategy.
    """
    # Analyze query
    analysis = await orchestrator.analyze_query(request.query, user_id)

    # Build orchestration request
    task_type = TaskType(analysis.get("best_task_type", "parallel"))
    roles = [AgentRole(r) for r in analysis.get("required_roles", ["researcher", "analyst"])[:3]]

    orchestrate_request = OrchestrateRequest(
        prompt=request.query,
        task_type=task_type,
        roles=roles,
        max_agents=analysis.get("estimated_agents", 3),
        include_reasoning=True
    )

    # Execute orchestration
    result = await orchestrator.orchestrate(orchestrate_request, user_id)

    return {
        "analysis": analysis,
        "result": result
    }

@app.post("/api/v1/workflow")
async def run_custom_workflow(
    request: WorkflowRequest,
    user_id: str = Query(...)
):
    """
    Execute a custom multi-agent workflow with defined steps.
    """
    start_time = datetime.now()
    workflow_id = str(uuid.uuid4())

    # Convert steps to workflow format
    workflow_steps = [
        {"role": step.agent_role.value, "instruction": step.instruction}
        for step in request.steps
    ]

    # Execute sequential workflow
    responses = await orchestrator.run_sequential(workflow_steps, request.initial_input, user_id)

    # Apply merge strategy
    if request.merge_strategy == "concatenate":
        final_output = "\n\n---\n\n".join([
            f"**Step {i+1} ({r.role}):**\n{r.response}"
            for i, r in enumerate(responses)
        ])
    elif request.merge_strategy == "best_of":
        # Select highest confidence response
        best = max(responses, key=lambda r: r.confidence) if responses else None
        final_output = best.response if best else ""
    else:  # synthesize
        synthesis = await orchestrator.synthesize_responses(responses, request.initial_input, user_id)
        final_output = synthesis["response"]

    total_latency = int((datetime.now() - start_time).total_seconds() * 1000)

    return {
        "workflow_id": workflow_id,
        "name": request.name,
        "final_output": final_output,
        "steps_executed": len(responses),
        "step_responses": [
            {
                "step": i + 1,
                "role": r.role,
                "response": r.response,
                "tokens": r.tokens_used
            }
            for i, r in enumerate(responses)
        ],
        "total_tokens": sum(r.tokens_used for r in responses),
        "total_latency_ms": total_latency
    }

@app.get("/api/v1/expert-agents")
async def list_expert_agents():
    """List all available expert agents"""
    return {
        "agents": [
            {
                "id": f"builtin_{key}",
                "name": config["name"],
                "role": key,
                "capabilities": config["capabilities"],
                "model": config["model"],
                "description": config["system_prompt"][:200] + "..."
            }
            for key, config in EXPERT_AGENTS.items()
        ]
    }

@app.post("/api/v1/compare-agents")
async def compare_agents(
    prompt: str = Query(...),
    agents: List[str] = Query(...),
    user_id: str = Query(...)
):
    """
    Compare responses from multiple agents side-by-side.
    Useful for evaluating which agent performs best for a given task.
    """
    roles = [a.replace("builtin_", "") for a in agents if a.replace("builtin_", "") in EXPERT_AGENTS]

    if not roles:
        roles = ["researcher", "analyst", "writer"]

    responses = await orchestrator.run_parallel_agents(roles, prompt, "", user_id)
    valid_responses = [r for r in responses if isinstance(r, AgentResponse)]

    # Score each response
    comparison_prompt = f"""Rate each agent response on these criteria (1-10):
- Accuracy: How factually correct is it?
- Completeness: Does it fully address the question?
- Clarity: Is it easy to understand?
- Usefulness: Is it actionable/valuable?

Original question: {prompt}

Responses:
{chr(10).join([f'{r.agent_name}: {r.response[:500]}...' for r in valid_responses])}

Provide scores and a brief explanation for each agent. Then declare the winner."""

    evaluation = await orchestrator.call_ai(
        model=FAST_MODEL,
        messages=[{"role": "user", "content": comparison_prompt}],
        user_id=user_id
    )

    return {
        "prompt": prompt,
        "agent_responses": [
            {
                "agent_id": r.agent_id,
                "agent_name": r.agent_name,
                "response": r.response,
                "tokens_used": r.tokens_used,
                "latency_ms": r.latency_ms
            }
            for r in valid_responses
        ],
        "evaluation": evaluation.get("choices", [{}])[0].get("message", {}).get("content", ""),
        "total_tokens": sum(r.tokens_used for r in valid_responses)
    }

@app.post("/api/v1/fact-check")
async def fact_check(
    content: str = Query(..., description="Content to fact-check"),
    user_id: str = Query(...)
):
    """
    Run content through fact-checking agent with source verification.
    """
    fact_checker = await orchestrator.run_agent(
        role="fact_checker",
        prompt=f"Fact-check the following content. Identify claims, verify accuracy, and provide corrections where needed:\n\n{content}",
        context="",
        user_id=user_id
    )

    return {
        "original_content": content,
        "fact_check_report": fact_checker.response,
        "agent": fact_checker.agent_name,
        "tokens_used": fact_checker.tokens_used
    }

@app.post("/api/v1/improve-content")
async def improve_content(
    content: str = Query(...),
    improvement_type: Literal["clarity", "engagement", "accuracy", "all"] = Query(default="all"),
    user_id: str = Query(...)
):
    """
    Run content through multiple agents to improve it.
    """
    roles_map = {
        "clarity": ["writer"],
        "engagement": ["creative", "writer"],
        "accuracy": ["fact_checker", "analyst"],
        "all": ["writer", "critic", "fact_checker"]
    }

    roles = roles_map.get(improvement_type, ["writer", "critic"])

    # Sequential improvement
    workflow = [
        {"role": roles[0], "instruction": f"Improve this content for {improvement_type}:\n\n{content}"}
    ]

    for role in roles[1:]:
        workflow.append({
            "role": role,
            "instruction": f"Review and further improve the content. Focus on {improvement_type}."
        })

    responses = await orchestrator.run_sequential(workflow, content, user_id)

    return {
        "original": content,
        "improved": responses[-1].response if responses else content,
        "improvement_steps": [
            {"role": r.role, "changes": r.response[:500]}
            for r in responses
        ],
        "total_tokens": sum(r.tokens_used for r in responses)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
