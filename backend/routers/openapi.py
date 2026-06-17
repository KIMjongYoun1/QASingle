from fastapi import APIRouter, UploadFile, File, HTTPException
import json
import yaml

router = APIRouter(prefix="/api/openapi", tags=["openapi"])

METHODS = ("get", "post", "put", "patch", "delete")


def _load_spec(raw: bytes, filename: str) -> dict:
    text = raw.decode("utf-8")
    try:
        if filename.endswith((".yaml", ".yml")):
            return yaml.safe_load(text)
        return json.loads(text)
    except Exception:
        try:
            return yaml.safe_load(text)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"스펙 파싱 실패: {str(e)}")


def _first_2xx_status(responses: dict) -> int:
    for code in responses or {}:
        if code.isdigit() and code.startswith("2"):
            return int(code)
    return 200


def _has_required_param(op: dict) -> bool:
    # path 파라미터는 누락 시 다른 라우트가 되므로 제외 (query/header만 검사)
    params = op.get("parameters") or []
    if any(p.get("required") and p.get("in") != "path" for p in params):
        return True
    body = op.get("requestBody") or {}
    if body.get("required"):
        return True
    return False


def _sample_value(schema: dict):
    if not isinstance(schema, dict):
        return ""
    if "example" in schema:
        return schema["example"]
    if "enum" in schema and schema["enum"]:
        return schema["enum"][0]
    t = schema.get("type")
    if t == "integer" or t == "number":
        return 1
    if t == "boolean":
        return True
    if t == "array":
        return []
    if t == "object":
        props = schema.get("properties") or {}
        return {k: _sample_value(v) for k, v in props.items()}
    return "string"


def _body_sample(op: dict) -> str:
    body = op.get("requestBody") or {}
    schema = ((body.get("content") or {}).get("application/json") or {}).get("schema") or {}
    sample = _sample_value(schema)
    if sample == "":
        return ""
    return json.dumps(sample, ensure_ascii=False, indent=2)


def _headers_for(op: dict) -> list[dict]:
    headers = [
        {"key": p["name"], "value": str(_sample_value(p.get("schema") or {}))}
        for p in (op.get("parameters") or [])
        if p.get("in") == "header"
    ]
    if op.get("requestBody"):
        headers.insert(0, {"key": "Content-Type", "value": "application/json"})
    return headers


def _query_params_for(op: dict) -> list[dict]:
    return [
        {"key": p["name"], "value": str(_sample_value(p.get("schema") or {}))}
        for p in (op.get("parameters") or [])
        if p.get("in") == "query"
    ]


@router.post("/parse")
async def parse_openapi(file: UploadFile = File(...)):
    if not file.filename.endswith((".json", ".yaml", ".yml")):
        raise HTTPException(status_code=400, detail="json/yaml 파일만 지원합니다")

    contents = await file.read()
    spec = _load_spec(contents, file.filename)

    if not isinstance(spec, dict) or "paths" not in spec:
        raise HTTPException(status_code=400, detail="OpenAPI 스펙 형식이 아닙니다 (paths 없음)")

    servers = spec.get("servers") or []
    base_url = servers[0]["url"] if servers and "url" in servers[0] else ""

    cases = []
    categories = set()
    auto_id = 1

    for path, methods in spec["paths"].items():
        if not isinstance(methods, dict):
            continue
        for method, op in methods.items():
            if method.lower() not in METHODS or not isinstance(op, dict):
                continue

            summary = op.get("summary") or f"{method.upper()} {path}"
            tags = op.get("tags") or []
            category = tags[0] if tags else "기타"
            categories.add(category)
            expected_status = _first_2xx_status(op.get("responses"))
            headers = _headers_for(op)
            query_params = _query_params_for(op)
            body = _body_sample(op)

            cases.append({
                "id": f"TC-{str(auto_id).zfill(3)}",
                "name": f"{summary} - 정상 요청",
                "type": "Positive",
                "input": f"{method.upper()} {path}",
                "expected": f"{expected_status} 응답",
                "actual": "", "pf": "Pass", "owner": "", "date": "",
                "catName": category,
                "endpoint": path, "method": method.upper(), "expectedStatus": expected_status,
                "headers": headers, "queryParams": query_params, "body": body,
            })
            auto_id += 1

            if _has_required_param(op):
                missing_headers = [h for h in headers if h["key"] != "Content-Type"]
                missing_query = [{**q, "value": ""} for q in query_params if q]
                cases.append({
                    "id": f"TC-{str(auto_id).zfill(3)}",
                    "name": f"{summary} - 필수값 누락",
                    "type": "Negative",
                    "input": f"{method.upper()} {path} (필수 파라미터 누락)",
                    "expected": "400 응답",
                    "actual": "", "pf": "Pass", "owner": "", "date": "",
                    "catName": category,
                    "endpoint": path, "method": method.upper(), "expectedStatus": 400,
                    "headers": missing_headers, "queryParams": missing_query, "body": "",
                })
                auto_id += 1

    return {
        "cases": cases,
        "categories": list(categories),
        "baseUrl": base_url,
        "total": len(cases),
    }
