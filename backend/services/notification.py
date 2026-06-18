"""
알림 서비스 — Discord / Slack 웹훅 전송

지원 이벤트:
  - run_completed : 실행 정상 완료 (fail 포함 가능)
  - run_failed    : 실행 자체가 오류로 종료
"""

import httpx
from datetime import datetime, timezone
from typing import Literal

NotifyEvent = Literal["run_completed", "run_failed"]

_TIMEOUT = 5
_MAX_CASE_LIST = 10  # 케이스 목록 최대 표시 개수


class NotificationService:

    def dispatch(self, configs: list[dict], event: NotifyEvent, payload: dict):
        for cfg in configs:
            if not cfg.get("enabled"):
                continue
            if event not in (cfg.get("events") or []):
                continue
            try:
                if cfg["type"] == "discord":
                    self._send_discord(cfg["webhook_url"], event, payload)
                elif cfg["type"] == "slack":
                    self._send_slack(cfg["webhook_url"], event, payload)
            except Exception as e:
                print(f"[notification] {cfg['type']} 전송 실패: {e}")

    # ── 공통 헬퍼 ────────────────────────────────────────────────────────────

    def _summary(self, event: NotifyEvent, payload: dict) -> tuple[str, str, str]:
        """(icon, title, status_line) 반환"""
        fail = payload.get("fail", 0)
        total = payload.get("total", 0)
        passed = total - fail

        if event == "run_failed":
            return "🚨", "실행 오류", payload.get("error", "알 수 없는 오류")
        elif fail > 0:
            return "⚠️", "실행 완료 — 실패 포함", f"{passed}/{total} 통과 · {fail}건 실패"
        else:
            return "✅", "실행 완료 — 전체 통과", f"{total}/{total} 통과"

    def _now_kst(self) -> str:
        now = datetime.now(timezone.utc)
        return now.strftime("%Y-%m-%d %H:%M UTC")

    # ── Discord ──────────────────────────────────────────────────────────────

    def _send_discord(self, url: str, event: NotifyEvent, payload: dict):
        icon, title, status_line = self._summary(event, payload)

        run_id      = payload.get("run_id")
        label       = payload.get("label") or f"Run #{run_id}"
        total       = payload.get("total", 0)
        fail        = payload.get("fail", 0)
        passed      = total - fail
        project     = payload.get("project_name", "")
        base_url    = payload.get("base_url", "")
        failed_cases = payload.get("failed_cases", [])
        flow_results = payload.get("flow_results", [])

        color = 0x22c55e if fail == 0 and event != "run_failed" else (0xf97316 if fail > 0 else 0xef4444)

        fields = [
            {"name": "프로젝트", "value": project or "—", "inline": True},
            {"name": "실행 레이블", "value": label, "inline": True},
            {"name": "대상 서버", "value": f"`{base_url}`" if base_url else "—", "inline": False},
            {"name": "전체", "value": str(total), "inline": True},
            {"name": "통과", "value": str(passed), "inline": True},
            {"name": "실패", "value": str(fail), "inline": True},
        ]

        # 실패 케이스 목록
        if failed_cases:
            lines = []
            for c in failed_cases[:_MAX_CASE_LIST]:
                lines.append(f"• `{c['id']}` {c['name']}")
            if len(failed_cases) > _MAX_CASE_LIST:
                lines.append(f"_외 {len(failed_cases) - _MAX_CASE_LIST}건 더..._")
            fields.append({"name": f"❌ 실패 케이스 ({len(failed_cases)}건)", "value": "\n".join(lines), "inline": False})

        # 플로우 결과 요약
        if flow_results:
            flow_lines = []
            for fr in flow_results:
                f_icon = "✅" if fr.get("passed") else "❌"
                flow_lines.append(f"{f_icon} {fr.get('flow_name', f'Flow #{fr.get(\"flow_id\")}')}")
            fields.append({"name": "테스트 플로우", "value": "\n".join(flow_lines), "inline": False})

        body = {
            "embeds": [{
                "title": f"{icon} {title}",
                "color": color,
                "fields": fields,
                "footer": {"text": f"Single_QA_Tools · Run #{run_id} · {self._now_kst()}"},
            }]
        }
        httpx.post(url, json=body, timeout=_TIMEOUT)

    # ── Slack ─────────────────────────────────────────────────────────────────

    def _send_slack(self, url: str, event: NotifyEvent, payload: dict):
        icon, title, status_line = self._summary(event, payload)

        run_id       = payload.get("run_id")
        label        = payload.get("label") or f"Run #{run_id}"
        total        = payload.get("total", 0)
        fail         = payload.get("fail", 0)
        passed       = total - fail
        project      = payload.get("project_name", "")
        base_url     = payload.get("base_url", "")
        failed_cases = payload.get("failed_cases", [])
        flow_results = payload.get("flow_results", [])

        blocks = [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": f"{icon} {title}", "emoji": True},
            },
            {
                "type": "section",
                "fields": [
                    {"type": "mrkdwn", "text": f"*프로젝트*\n{project or '—'}"},
                    {"type": "mrkdwn", "text": f"*실행 레이블*\n{label}"},
                    {"type": "mrkdwn", "text": f"*전체*\n{total}건"},
                    {"type": "mrkdwn", "text": f"*통과 / 실패*\n{passed} / {fail}"},
                ],
            },
        ]

        if base_url:
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*대상 서버*: `{base_url}`"},
            })

        # 실패 케이스 목록
        if failed_cases:
            lines = [f"• `{c['id']}` {c['name']}" for c in failed_cases[:_MAX_CASE_LIST]]
            if len(failed_cases) > _MAX_CASE_LIST:
                lines.append(f"_외 {len(failed_cases) - _MAX_CASE_LIST}건 더..._")
            blocks.append({"type": "divider"})
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"*❌ 실패 케이스 ({len(failed_cases)}건)*\n" + "\n".join(lines)},
            })

        # 플로우 결과 요약
        if flow_results:
            flow_lines = []
            for fr in flow_results:
                f_icon = "✅" if fr.get("passed") else "❌"
                flow_lines.append(f"{f_icon} {fr.get('flow_name', f'Flow #{fr.get(\"flow_id\")}')}")
            blocks.append({"type": "divider"})
            blocks.append({
                "type": "section",
                "text": {"type": "mrkdwn", "text": "*테스트 플로우*\n" + "\n".join(flow_lines)},
            })

        blocks.append({"type": "divider"})
        blocks.append({
            "type": "context",
            "elements": [{"type": "mrkdwn", "text": f"Single_QA_Tools · Run #{run_id} · {self._now_kst()}"}],
        })

        httpx.post(url, json={"blocks": blocks}, timeout=_TIMEOUT)


notification_service = NotificationService()
