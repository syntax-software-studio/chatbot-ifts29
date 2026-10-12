FROM postgres:16

# Instala tzdata para soportar zonas horarias
RUN apt-get update && apt-get install -y tzdata && rm -rf /var/lib/apt/lists/*

ENV POSTGRES_DB=ifts29
ENV POSTGRES_PASSWORD=password123
ENV POSTGRES_USER=postgres

# Copia los scripts SQL de inicialización
COPY db/001_schema.sql /docker-entrypoint-initdb.d/01-schema.sql
COPY db/002_seed.sql /docker-entrypoint-initdb.d/02-seed.sql

# Expone el puerto
EXPOSE 5432
