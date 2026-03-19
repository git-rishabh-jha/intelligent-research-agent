from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

# Generate by this command : python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = "f149747d2acc79f1c382f99f2b1ca608f85a43fb9c122678bdd9a5cbc755b06d"

ALGORITHM = "HS256" # Algorithm to encrypt the password and storing it in the db

ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

IST = ZoneInfo("Asia/Kolkata")

def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):

    to_encode = data.copy()
    expire = datetime.now(IST) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
