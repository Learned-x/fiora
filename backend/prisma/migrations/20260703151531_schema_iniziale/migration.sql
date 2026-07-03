-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255),
    "password_hash" VARCHAR(255),
    "provider" VARCHAR(50),
    "provider_id" VARCHAR(255),
    "clima" VARCHAR(50) NOT NULL DEFAULT 'temperato',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trefle_species_raw" (
    "trefle_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "scientific_name" TEXT NOT NULL,
    "common_name" TEXT,
    "family" TEXT,
    "family_common_name" TEXT,
    "genus" TEXT,
    "rank" TEXT,
    "status" TEXT,
    "data" JSONB NOT NULL,
    "updated_at_trefle" TIMESTAMPTZ,
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trefle_species_raw_pkey" PRIMARY KEY ("trefle_id")
);

-- CreateTable
CREATE TABLE "species" (
    "id" UUID NOT NULL,
    "nome_comune" VARCHAR(255) NOT NULL,
    "nome_scientifico" VARCHAR(255),
    "categoria" VARCHAR(100),
    "luce" VARCHAR(50) NOT NULL,
    "annaffiatura" VARCHAR(50) NOT NULL,
    "umidita" VARCHAR(50),
    "temp_min" INTEGER,
    "temp_max" INTEGER,
    "tossicita" BOOLEAN,
    "note_cura" TEXT,
    "soglia_umidita" INTEGER,
    "fonte" VARCHAR(50) NOT NULL,
    "stato" VARCHAR(50) NOT NULL DEFAULT 'attivo',
    "trefle_id" INTEGER,
    "immagine_principale_url" VARCHAR(500),
    "proposto_da" UUID,
    "approvato_da" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plants" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "species_id" UUID,
    "posizione" VARCHAR(255),
    "foto_url" VARCHAR(500),
    "stato" VARCHAR(50) NOT NULL DEFAULT 'attivo',
    "stato_bouquet" VARCHAR(50),
    "data_ricezione" DATE,
    "vaso_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "plants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smart_vases" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "device_id" VARCHAR(255) NOT NULL,
    "nome" VARCHAR(255),
    "stato" VARCHAR(50) NOT NULL DEFAULT 'disconnesso',
    "batteria" INTEGER,
    "last_seen" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smart_vases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "sorgente" VARCHAR(50) NOT NULL,
    "stato" VARCHAR(50) NOT NULL DEFAULT 'pending',
    "scadenza" TIMESTAMPTZ NOT NULL,
    "completato_a" TIMESTAMPTZ,
    "nota" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_logs" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "tipo" VARCHAR(100) NOT NULL,
    "nota" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_diary" (
    "id" UUID NOT NULL,
    "plant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "foto_url" VARCHAR(500) NOT NULL,
    "nota" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_diary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "time" TIMESTAMPTZ NOT NULL,
    "vaso_id" UUID NOT NULL,
    "plant_id" UUID,
    "umidita" SMALLINT,
    "luce" INTEGER,
    "temperatura" DECIMAL(4,1),
    "batteria" SMALLINT,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("vaso_id","time")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_trefle_raw_scientific_name" ON "trefle_species_raw"("scientific_name");

-- CreateIndex
CREATE INDEX "idx_trefle_raw_common_name" ON "trefle_species_raw"("common_name");

-- CreateIndex
CREATE INDEX "idx_trefle_raw_family" ON "trefle_species_raw"("family");

-- CreateIndex
CREATE UNIQUE INDEX "species_trefle_id_key" ON "species"("trefle_id");

-- CreateIndex
CREATE INDEX "idx_species_nome" ON "species"("nome_comune");

-- CreateIndex
CREATE INDEX "idx_plants_user_stato" ON "plants"("user_id", "stato");

-- CreateIndex
CREATE UNIQUE INDEX "smart_vases_device_id_key" ON "smart_vases"("device_id");

-- CreateIndex
CREATE INDEX "idx_tasks_user_scadenza" ON "tasks"("user_id", "scadenza");

-- CreateIndex
CREATE INDEX "idx_action_logs_plant" ON "action_logs"("plant_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_sensor_readings_vaso_time" ON "sensor_readings"("vaso_id", "time" DESC);

-- AddForeignKey
ALTER TABLE "species" ADD CONSTRAINT "species_trefle_id_fkey" FOREIGN KEY ("trefle_id") REFERENCES "trefle_species_raw"("trefle_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "species" ADD CONSTRAINT "species_proposto_da_fkey" FOREIGN KEY ("proposto_da") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "species" ADD CONSTRAINT "species_approvato_da_fkey" FOREIGN KEY ("approvato_da") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_species_id_fkey" FOREIGN KEY ("species_id") REFERENCES "species"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plants" ADD CONSTRAINT "plants_vaso_id_fkey" FOREIGN KEY ("vaso_id") REFERENCES "smart_vases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smart_vases" ADD CONSTRAINT "smart_vases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_diary" ADD CONSTRAINT "photo_diary_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photo_diary" ADD CONSTRAINT "photo_diary_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_vaso_id_fkey" FOREIGN KEY ("vaso_id") REFERENCES "smart_vases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_plant_id_fkey" FOREIGN KEY ("plant_id") REFERENCES "plants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
