-- AlterTable
ALTER TABLE "plants" ADD COLUMN     "stato_bouquet_manuale" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mostra_nomi_scientifici" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "orario_reminder" VARCHAR(50) NOT NULL DEFAULT 'mattina_9',
ADD COLUMN     "push_token" VARCHAR(255),
ADD COLUMN     "role" VARCHAR(50) NOT NULL DEFAULT 'user';

-- CreateTable
CREATE TABLE "app_options" (
    "id" UUID NOT NULL,
    "categoria" VARCHAR(100) NOT NULL,
    "chiave" VARCHAR(100) NOT NULL,
    "etichetta" VARCHAR(255) NOT NULL,
    "ordine" INTEGER NOT NULL DEFAULT 0,
    "attivo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "app_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_app_options_categoria_ordine" ON "app_options"("categoria", "ordine");

-- CreateIndex
CREATE UNIQUE INDEX "app_options_categoria_chiave_key" ON "app_options"("categoria", "chiave");
