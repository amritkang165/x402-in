import hashlib
import json
import sqlite3
from datetime import datetime

from backend.core.database import db_session

GENESIS_HASH = "0" * 64


def _canonical_json(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), default=str)


def _hash(data: dict) -> str:
    return hashlib.sha256(_canonical_json(data).encode("utf-8")).hexdigest()


class AuditLogger:
    def _get_last_hash(self, conn: sqlite3.Connection, session_id: str) -> str:
        row = conn.execute(
            """
            SELECT current_hash FROM audit_logs
            WHERE session_id = ?
            ORDER BY id DESC LIMIT 1
            """,
            (session_id,),
        ).fetchone()
        return row["current_hash"] if row else GENESIS_HASH

    def log(self, session_id: str, action_type: str, actor: str, details: dict) -> dict:
        with db_session() as conn:
            previous_hash = self._get_last_hash(conn, session_id)
            timestamp = datetime.utcnow().isoformat()

            entry_data = {
                "timestamp": timestamp,
                "session_id": session_id,
                "action_type": action_type,
                "actor": actor,
                "details": details,
                "previous_hash": previous_hash,
            }
            current_hash = _hash(entry_data)

            conn.execute(
                """
                INSERT INTO audit_logs
                    (session_id, timestamp, action_type, actor, details,
                     previous_hash, current_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session_id,
                    timestamp,
                    action_type,
                    actor,
                    json.dumps(details, default=str),
                    previous_hash,
                    current_hash,
                ),
            )

            return {
                "timestamp": timestamp,
                "session_id": session_id,
                "action_type": action_type,
                "actor": actor,
                "details": details,
                "previous_hash": previous_hash,
                "current_hash": current_hash,
            }

    def get_chain(self, session_id: str) -> list[dict]:
        with db_session() as conn:
            rows = conn.execute(
                """
                SELECT id, session_id, timestamp, action_type, actor, details,
                       previous_hash, current_hash
                FROM audit_logs WHERE session_id = ? ORDER BY id ASC
                """,
                (session_id,),
            ).fetchall()
            return [dict(r) for r in rows]

    def verify_chain(self, session_id: str) -> tuple[bool, str]:
        with db_session() as conn:
            entries = conn.execute(
                """
                SELECT id, session_id, timestamp, action_type, actor, details,
                       previous_hash, current_hash
                FROM audit_logs WHERE session_id = ? ORDER BY id ASC
                """,
                (session_id,),
            ).fetchall()

        if not entries:
            return True, "No entries to verify"

        previous_hash = GENESIS_HASH
        for entry in entries:
            details = json.loads(entry["details"])
            entry_data = {
                "timestamp": entry["timestamp"],
                "session_id": entry["session_id"],
                "action_type": entry["action_type"],
                "actor": entry["actor"],
                "details": details,
                "previous_hash": entry["previous_hash"],
            }
            expected_hash = _hash(entry_data)
            if expected_hash != entry["current_hash"]:
                return False, (
                    f"Hash mismatch at entry {entry['id']}: "
                    f"expected {expected_hash}, got {entry['current_hash']}"
                )
            if entry["previous_hash"] != previous_hash:
                return False, f"Chain break at entry {entry['id']}"
            previous_hash = entry["current_hash"]

        return True, f"Chain verified: {len(entries)} entries, no tampering detected"


audit = AuditLogger()
