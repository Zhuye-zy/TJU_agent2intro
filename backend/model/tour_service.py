"""C-owned R3 implementation slot. M0 intentionally reports NOT_IMPLEMENTED."""
from backend.common.errors import DomainError

class PendingTourService:
    implementation = "not_implemented"
    async def create(self, body):
        raise DomainError("TOUR_NOT_IMPLEMENTED", "R3行程服务待C窗口实现", 501, body.request_id)
    async def read(self, tour_id, session_id):
        raise DomainError("TOUR_NOT_IMPLEMENTED", "R3行程服务待C窗口实现", 501)
    async def revise(self, tour_id, body):
        raise DomainError("TOUR_NOT_IMPLEMENTED", "R3行程修改待C窗口实现", 501, body.request_id)
    async def command(self, tour_id, body):
        raise DomainError("TOUR_NOT_IMPLEMENTED", "R3行程执行待C窗口实现", 501, body.request_id)
    async def restore(self, body):
        raise DomainError("TOUR_NOT_IMPLEMENTED", "R3行程恢复待C窗口实现", 501, body.request_id)

tour_service = PendingTourService()