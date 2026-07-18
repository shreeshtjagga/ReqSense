from slowapi import Limiter
from slowapi.util import get_remote_address
from app.config import get_settings

settings = get_settings()

# Initialize the Limiter using the remote address
limiter = Limiter(key_func=get_remote_address)
