from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.core.database import db_session
from backend.theatre.websocket_manager import manager

router = APIRouter(tags=["theatre"])


@router.websocket("/ws/theatre/{session_id}")
async def theatre_ws(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id, websocket)


@router.get("/sessions")
def list_sessions():
    with db_session() as conn:
        rows = conn.execute(
            "SELECT * FROM sessions ORDER BY created_at DESC LIMIT 50"
        ).fetchall()
    return [dict(r) for r in rows]
