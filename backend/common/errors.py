class DomainError(Exception):
    def __init__(self, code: str, message: str, status: int = 501, request_id=None, retryable=False):
        self.code, self.message, self.status = code, message, status
        self.request_id, self.retryable = request_id, retryable
