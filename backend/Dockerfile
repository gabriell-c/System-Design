FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY alembic.ini .
COPY alembic ./alembic
RUN mkdir -p /app/data

# Non-root runtime user (mirrors web/Dockerfile's `USER node`).
# Assumption: the container's compose build uses Postgres (no volume mounted
# at /app/data); SQLite here is dev-only fallback, and /app/data is
# chowned below so the non-root user can still write to it.
RUN groupadd --gid 1000 archia && \
    useradd --uid 1000 --gid archia --shell /usr/sbin/nologin archia && \
    chown -R archia:archia /app

ENV DATABASE_URL=sqlite:///./data/app.db
ENV CORS_ORIGINS=http://localhost:3015
ENV LOG_JSON=true
EXPOSE 4410

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:4410/api/health', timeout=3)"

USER archia

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 4410"]
