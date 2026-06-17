"""
알림 서비스 — Discord / Slack 웹훅 전송 뼈대

지원 이벤트:
  - run_completed : 실행 정상 완료 (fail 포함 가능)
  - run_failed    : 실행 자체가 오류로 종료

사용법:
  notification_service.dispatch(configs, "run_completed", payload)
"""

import httpx
from typing import Literal

NotifyEvent = Literal["run_completed", "run_failed"]

_TIMEOUT = 5  # 웹훅 전송 타임아웃 (초)


class NotificationService:

    def dispatch(self, configs: list[dict], event: NotifyEvent, payload: dict):
        """활성화된 configs 중 해당 event를 구독하는 것에만 전송"""
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

    # ── Discord ─────────────────────────────────────────────────────────────

    def _send_discord(self, url: str, event: NotifyEvent, payload: dict):
        run_id = payload.get("run_id")
        label = payload.get("label") or f"Run #{run_id}"
        total = payload.get("total", 0)
        fail = payload.get("fail", 0)
        passed = total - fail

        if event == "run_failed":
            color = 0xef4444
            title = "🚨 실행 오류"
            desc = payload.get("error", "알 수 없는 오류")
        elif fail > 0:
            color = 0xf97316
            title = "⚠️ 실행 완료 — 실패 포함"
            desc = label
        else:
            color = 0x22c55e
            title = "✅ 실행 완료 — 전체 통과"
            desc = label

        body = {
            "embeds": [{
                "title": title,
                "description": desc,
                "color": color,
                "fields": [
                    {"name": "전체", "value": str(total), "inline": True},
                    {"name": "통과", "value": str(passed), "inline": True},
                    {"name": "실패", "value": str(fail), "inline": True},
                ],
            }]
        }
        httpx.post(url, json=body, timeout=_TIMEOUT)

    # ── Slack ────────────────────────────────────────────────────────────────

    def _send_slack(self, url: str, event: NotifyEvent, payload: dict):
        run_id = payload.get("run_id")
        label = payload.get("label") or f"Run #{run_id}"
        total = payload.get("total", 0)
        fail = payload.get("fail", 0)
        passed = total - fail

        if event == "run_failed":
            icon = "🚨"
            summary = f"실행 오류: {payload.get('error', '알 수 없는 오류')}"
        elif fail > 0:
            icon = "⚠️"
            summary = f"전체 {total}건 중 {fail}건 실패"
        else:
            icon = "✅"
            summary = f"전체 {total}건 통과"

        text = f"{icon} *{label}*\n{summary}\n통과: {passed}  |  실패: {fail}  |  전체: {total}"
        httpx.post(url, json={"text": text}, timeout=_TIMEOUT)


notification_service = NotificationService()
