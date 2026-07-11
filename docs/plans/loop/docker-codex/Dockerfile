FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    python3 \
    python3-pip \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Codex CLI. If OpenAI changes the package name, update this one line.
RUN npm install -g @openai/codex

ENV CODEX_HOME=/root/.codex
WORKDIR /out

CMD ["codex", "--help"]
