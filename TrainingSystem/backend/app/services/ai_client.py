"""Qwen / OpenAI-compatible AI 客户端（基于 httpx）"""
import json
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TIMEOUT = httpx.Timeout(120.0)


async def chat_completion(
    messages: list[dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 4096,
    json_mode: bool = False,
) -> str:
    """调用 OpenAI 兼容接口，返回 assistant 内容字符串。"""
    headers = {
        "Authorization": f"Bearer {settings.AI_API_KEY}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": settings.AI_MODEL_NAME,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if json_mode:
        body["response_format"] = {"type": "json_object"}

    url = f"{settings.AI_API_BASE_URL.rstrip('/')}/chat/completions"

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def extract_knowledge_candidates(chunk_content: str) -> list[dict]:
    """
    从文档片段中提取候选知识点列表。
    返回: [{"name": str, "description": str, "confidence": float}, ...]
    """
    system_prompt = (
        "你是一个企业培训内容分析专家。请从以下文档片段中提取关键知识点，"
        "以 JSON 格式输出一个列表，每个知识点包含：\n"
        "- name: 知识点名称（简短、明确）\n"
        "- description: 知识点描述（1-2句话）\n"
        "- confidence: 置信度（0.0-1.0，表示该片段对此知识点的代表性）\n"
        "若文档片段信息量不足，返回空列表 []。\n"
        "只输出合法 JSON，不要有其他文字。"
    )
    user_prompt = f"文档片段：\n\n{chunk_content[:3000]}"

    content = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        json_mode=True,
        temperature=0.2,
    )
    try:
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        # 部分模型返回 {"knowledge_points": [...]}
        for v in parsed.values():
            if isinstance(v, list):
                return v
    except Exception:
        logger.warning("Failed to parse knowledge candidates JSON: %s", content[:200])
    return []


async def generate_course(
    knowledge_points: list[dict],
    course_title: str,
    chapter_count: int = 5,
) -> dict:
    """
    根据知识点列表生成课程大纲和章节内容。
    返回: {"summary": str, "chapters": [{"title": str, "content": str, "duration_minutes": int}]}
    """
    kp_list = "\n".join(
        f"- {kp['name']}: {kp.get('description', '')}" for kp in knowledge_points[:30]
    )
    system_prompt = (
        "你是一名专业的企业培训课程设计师。请根据给定的知识点列表，"
        f"为课程《{course_title}》设计 {chapter_count} 个章节的完整课程内容。\n"
        "以 JSON 格式输出，包含：\n"
        "- summary: 课程总体介绍（100-200字）\n"
        "- chapters: 章节列表，每个章节包含：\n"
        "  - title: 章节标题\n"
        "  - content: 章节正文内容（300-800字，包含要点、示例、小结）\n"
        "  - duration_minutes: 预计学习时长（分钟）\n"
        "只输出合法 JSON，不要有其他文字。"
    )
    user_prompt = f"知识点列表：\n{kp_list}"

    content = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        json_mode=True,
        temperature=0.4,
        max_tokens=8192,
    )
    try:
        return json.loads(content)
    except Exception:
        logger.warning("Failed to parse course JSON: %s", content[:200])
        return {"summary": "", "chapters": []}


async def grade_answer(
    stem: str,
    scoring_criteria: str,
    reference_answer: str,
    student_answer: str,
    max_score: int = 10,
) -> dict:
    """使用 AI 对主观题进行评分。返回 {"score": int, "comment": str}"""
    system_prompt = (
        f"你是一位专业阅卷老师。请根据题目、评分标准和参考答案，对学生答案进行评分。\n"
        f"满分为 {max_score} 分。\n"
        "请以 JSON 格式输出：\n"
        "- score: 得分（整数，0 到满分之间）\n"
        "- comment: 评语（1-2句，说明扣分原因或肯定之处）\n"
        "只输出合法 JSON，不要有其他文字。"
    )
    user_prompt = (
        f"题目：{stem}\n\n"
        f"评分标准：{scoring_criteria}\n\n"
        f"参考答案：{reference_answer}\n\n"
        f"学生答案：{student_answer}"
    )
    try:
        content = await chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            json_mode=True,
            temperature=0.2,
        )
        result = json.loads(content)
        score = max(0, min(max_score, int(result.get("score", 0))))
        comment = str(result.get("comment", ""))
        return {"score": score, "comment": comment}
    except Exception as e:
        logger.warning("AI grading failed: %s", e)
        return {"score": 0, "comment": "AI评分失败，需人工批阅"}


async def generate_questions(
    source_content: str,
    question_types: list[str] | None = None,
    count: int = 10,
) -> list[dict]:
    """
    根据内容生成试题列表。
    返回: [{"type": str, "stem": str, "options": dict|None, "answer": dict, "analysis": str, "difficulty": int}]
    """
    if not question_types:
        question_types = ["single_choice", "true_false", "short_answer"]
    types_str = "、".join(question_types)

    system_prompt = (
        f"你是一位专业出题专家。请根据以下培训内容，生成 {count} 道题目，"
        f"题型包括：{types_str}。\n"
        "以 JSON 列表格式输出，每道题包含：\n"
        "- type: 题目类型（single_choice/multi_choice/true_false/fill_blank/short_answer）\n"
        "- stem: 题干\n"
        "- options: 选项（单选/多选题时为 {\"A\":\"...\",\"B\":\"...\",...}，其他题型为 null）\n"
        "- answer: 答案（{\"value\": ...}，选择题为字母如 \"A\", 判断题为 true/false, 简答题为文字）\n"
        "- analysis: 解析说明（1-2句）\n"
        "- difficulty: 难度等级（1-5，1最简单）\n"
        "只输出合法 JSON 数组，不要有其他文字。"
    )
    user_prompt = f"培训内容：\n\n{source_content[:4000]}"

    content = await chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        json_mode=True,
        temperature=0.5,
        max_tokens=8192,
    )
    try:
        parsed = json.loads(content)
        if isinstance(parsed, list):
            return parsed
        for v in parsed.values():
            if isinstance(v, list):
                return v
    except Exception:
        logger.warning("Failed to parse questions JSON: %s", content[:200])
    return []
