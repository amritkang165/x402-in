import asyncio
from collections import defaultdict
from datetime import datetime

from fastapi import WebSocket

GLOBAL_ROOM = "*"


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[str, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop | None):
        self._loop = loop

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.set_loop(asyncio.get_running_loop())
        self.rooms[session_id].add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket):
        self.rooms[session_id].discard(websocket)
        if not self.rooms[session_id]:
            del self.rooms[session_id]

    async def _send_room(self, room: str, message: dict):
        for ws in list(self.rooms.get(room, ())):
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(room, ws)

    async def broadcast(self, session_id: str, message: dict):
        """Send to a specific session's room AND the global room."""
        await self._send_room(session_id, message)
        global_room = GLOBAL_ROOM
        if session_id != global_room:
            await self._send_room(global_room, message)

    def queue(self, session_id: str, message: dict):
        """Thread/context-safe: schedule a broadcast from sync or async code."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        loop.call_soon_threadsafe(
            asyncio.ensure_future, self.broadcast(session_id, message)
        )


manager = ConnectionManager()


def make_event(
    session_id: str,
    actor: str,
    action_type: str,
    details: dict | None = None,
    sequence: int | None = None,
    message_id: str | None = None,
) -> dict:
    return {
        "id": message_id or f"{datetime.utcnow().timestamp()}-{actor}-{action_type}",
        "timestamp": datetime.utcnow().isoformat(),
        "session_id": session_id,
        "actor": actor,
        "action_type": action_type,
        "details": details or {},
        "sequence": sequence,
    }


def broadcast_event(
    session_id: str,
    actor: str,
    action_type: str,
    details: dict | None = None,
) -> None:
    """Publish a live theatre event. Safe to call from sync or async code."""
    manager.queue(session_id, make_event(session_id, actor, action_type, details))
