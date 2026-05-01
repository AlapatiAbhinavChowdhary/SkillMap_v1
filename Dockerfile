FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY Resume.csv ./
COPY models/ ./models/

EXPOSE 7860

CMD ["python", "app.py"]
