# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psutil
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create data directory and seed it
RUN mkdir -p data
RUN python ml_model/generate_sample_data.py

EXPOSE 8000

CMD ["python", "app.py"]
