FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
RUN mkdir -p /app/data

ENV DATABASE_URL=sqlite:///./data/app.db
ENV CORS_ORIGINS=http://localhost:3015
EXPOSE 4410
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "4410"]
