"""C-owned route-cost slot; never invent estimates or spend map quota on boot."""
from backend.common.errors import DomainError
class PendingCostService:
    async def estimate(self, body):
        raise DomainError("ROUTE_COST_NOT_IMPLEMENTED", "R3路线成本服务待C窗口实现", 501, body.request_id)
cost_service = PendingCostService()