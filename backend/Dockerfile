FROM python:3.14-slim
COPY --from=astral/uv:0.13.7 /uv /bin/uv
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy PATH="/app/.venv/bin:$PATH" PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY . .
RUN chmod +x entrypoint.sh \
    && DEBUG=1 python manage.py collectstatic --noinput \
    && useradd --system --uid 10001 app \
    && mkdir -p /tmp/oydin-cache && chown -R app /tmp/oydin-cache /app/staticfiles
USER app
EXPOSE 8000
CMD ["./entrypoint.sh"]
