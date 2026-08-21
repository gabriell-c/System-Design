FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic
RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:///./data/app.db
ENV CORS_ORIGINS=http://localhost:3015
ENV LOG_JSON=true
EXPOSE 4410
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 4410"]
