FROM python:3.11-slim-bookworm

WORKDIR /app

# Install system dependencies for Playwright (Debian Bookworm compatible)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    libnss3 \
    libnspr4 \
    libdbus-1-3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Copy only worker files (Railway builds from repo root)
COPY worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright Chromium (without --with-deps since we installed them above)
RUN playwright install chromium

COPY worker/ .

ENV PORT=8000
EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
